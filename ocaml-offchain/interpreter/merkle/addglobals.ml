
(* Use remapping from merge *)
open Merge
open Ast
open Types
open Source
open Sourceutil

(* remap function calls *)
let rec remap_func' map gmap gmap2 ftmap = function
 | Block (ty, lst) -> Block (ty, List.map (remap_func map gmap gmap2 ftmap) lst) 
 | Loop (ty, lst) -> Loop (ty, List.map (remap_func map gmap gmap2 ftmap) lst)
 | If (ty, texp, fexp) -> If (ty, List.map (remap_func map gmap gmap2 ftmap) texp, List.map (remap_func map gmap gmap2 ftmap) fexp)
 | GetGlobal v ->
   ( try gmap2 v.it with Not_found -> GetGlobal {v with it = gmap v.it} )
 | SetGlobal v -> SetGlobal {v with it = gmap v.it}
 | Call v -> Call {v with it = map v.it}
 | CallIndirect v -> CallIndirect {v with it = ftmap v.it}
 | a -> a

and remap_func map gmap gmap2 ftmap i = {i with it = remap_func' map gmap gmap2 ftmap i.it}

let rec remap' map gmap gmap2 ftmap f = {f with ftype={(f.ftype) with it = ftmap f.ftype.it}; body=List.map (remap_func map gmap gmap2 ftmap) f.body}
and remap map gmap gmap2 ftmap i = {i with it = remap' map gmap gmap2 ftmap i.it}

let remap_global map gmap gmap2 ftmap x =
  let res = {x with it={x.it with value = {x.it.value with it=List.map (remap_func map gmap gmap2 ftmap) x.it.value.it}}} in
  res

let do_it x f = {x with it=f x.it}
let elem x = {it=x; at=no_region}

let remap_elem_segments map gmap gmap2 ftmap el = do_it el (fun (x:'a segment') -> {x with offset=do_it x.offset (List.map (remap_func map gmap gmap2 ftmap))})

let conv_to_int x =
  if Char.code x.[0] = 34 then int_of_string (String.sub x 1 (String.length x - 2))
  else int_of_string x

let rec pairify = function
 | a::b::tl -> (a,b) :: pairify tl
 | _ -> []

(* First load the json file *)
let load_file fn =
  let open Yojson.Basic in
  let data = from_channel (open_in fn) in
  let lst = Util.to_assoc (Util.member "env" data) in
  let globals = List.map (fun (a,b) -> (a, int_of_string (to_string b))) lst in
  let mem = List.map (fun x -> conv_to_int (to_string x)) (Util.to_list (Util.member "mem" data)) in
  let tmem = int_of_string (to_string (Util.member "total_memory" data)) in
  globals, pairify mem, tmem

let add_import taken special imports map map2 num imp =
  (* check if import was already taken *)
  let name = "_" ^ Utf8.encode imp.it.module_name ^ "_" ^ Utf8.encode imp.it.item_name in
  if not (Hashtbl.mem taken name) then begin
    let loc = Int32.of_int (List.length !imports) in
    Hashtbl.add map (Int32.of_int num) loc;
    imports := imp :: !imports;
    trace ("Got import " ^ name);
    Hashtbl.add taken name loc
  end else begin
    let loc = Hashtbl.find taken name in
    trace ("Dropping import " ^ name);
    Hashtbl.add map (Int32.of_int num) loc
  end;
  if Hashtbl.mem special name then begin
    Hashtbl.add map2 (Int32.of_int num) (Hashtbl.find special name)
  end

let int_global i = GetGlobal {it=Int32.of_int i; at=no_region}

(* need to add a TOTAL_MEMORY global *)

let add_setters m =
  let asmjs = find_global_index m (Utf8.decode "ASMJS") in
  do_it m (fun m ->
    (* add function types *)
    let ftypes = m.types @ [
       it (FuncType ([I32Type], []));
       ] in
    let ftypes_len = List.length m.types in
    let set_type = it (Int32.of_int (ftypes_len)) in
    let make_func num =
      elem {
        ftype = set_type;
        locals = [];
        body = List.map it [GetLocal (it 0l); SetGlobal (it num)];
      } in
    (* add exports *)
    let fnum = List.length (func_imports (it m)) + List.length m.funcs in
    let added = [
       it {name=Utf8.decode "setHelperStack"; edesc=it (FuncExport (it (Int32.of_int fnum)))};
       it {name=Utf8.decode "setHelperStackLimit"; edesc=it (FuncExport (it (Int32.of_int (fnum+1))))};
    ] in
    let stack_ptr = asmjs - 16 in (* this is the difficult place *)
    let stack_max = stack_ptr + 1 in
    let set1 = make_func (Int32.of_int stack_ptr) in
    let set2 = make_func (Int32.of_int stack_max) in
    {m with funcs=m.funcs @ [set1; set2];
            types=ftypes;
            exports=m.exports @ added; })

let add_globals m fn =
  let globals, mem, tmem = load_file fn in
  let m =
     if !Flags.asmjs then add_setters (add_i32_global m "ASMJS" 1) else m in
  let m = add_i32_global m "TOTAL_MEMORY" tmem in
  (* let m = add_i32_global m "GAS" 0 in *)
  let m = add_i32_global m "GAS_LIMIT" (!Flags.gas_limit) in
  (*
  let m = add_f64_global m "GAS" (F64.of_float 0.0) in
  let m = add_f64_global m "GAS_LIMIT" (F64.of_float (Int64.to_float !Flags.gas_limit)) in
  *)
  (* Can easily add new globals *)
  let m = if has_import m "DYNAMICTOP_PTR" then m else
    try add_i32_global m "DYNAMICTOP_PTR" (List.assoc "DYNAMICTOP_PTR" globals)
    with Not_found -> m in
  let m = add_i32_global m "_system_ptr" 0 in
  let g_imports = ref [] in
  let gmap1 = Hashtbl.create 10 in
  let gmap2 = Hashtbl.create 10 in
  let ftmap1 x = x in
  (* remove imports that were defined in the file *)
  let taken_globals = Hashtbl.create 10 in
  let special_globals = Hashtbl.create 10 in
  let reserve_export i (x,y) =
    let name = "_env_" ^ x in
    let inst = Const (elem (Values.I32 (Int32.of_int y))) in
    Hashtbl.add special_globals name inst;
    trace ("Blah " ^ name ^ " fddd " ^ string_of_int (555+i));
    Hashtbl.add taken_globals name (Int32.add 555l (Int32.of_int i)) in
  List.iteri reserve_export globals;
  List.iteri (fun n x -> add_import taken_globals special_globals g_imports gmap1 gmap2 n x) (global_imports m);
  (* add the usual globals to gmap1 *)

  let num_ga = List.length (global_imports m) in

  let num_g = List.length !g_imports in
  let offset_ga = num_g - num_ga in

  List.iteri (fun i _ ->
    trace ("global " ^ string_of_int (i+num_ga) ^ " -> " ^ string_of_int (i + num_ga + offset_ga));
    Hashtbl.add gmap1 (Int32.of_int (i + num_ga)) (Int32.of_int (i + num_ga + offset_ga))) m.it.globals;

  List.iter (fun (x,y) -> trace ("Global " ^ x ^ " = " ^ string_of_int y)) globals;
  (* initialize these globals differently *)
  (* when initializing globals, cannot access previous globals *)
  (* remap exports *)
  let exports_a = List.map (remap_export (fun x -> x) (Hashtbl.find gmap1) ftmap1 "") m.it.exports in
  (* funcs will have to be remapped *)
  let funcs_a = List.map (remap (fun x -> x) (Hashtbl.find gmap1) (Hashtbl.find gmap2) ftmap1) m.it.funcs in
  (* table elements have to be remapped *)
  trace ("Remapping globals");
  let new_data = List.map generate_data mem in
  let mem_size = Int32.of_int (Byteutil.pow2 (!Flags.memory_size - 13)) in
  let mem = {
     idesc=elem (MemoryImport (MemoryType {min=mem_size; max=Some mem_size}));
     module_name=Utf8.decode "env";
     item_name=Utf8.decode "memory";
  } in
  let table = if other_imports_nomem m = [] then [] else [
  elem {idesc=elem (TableImport (TableType ({min=100000l; max=None}, AnyFuncType)));
     module_name=Utf8.decode "env";
     item_name=Utf8.decode "table";
  }
  ] in
  {m with it={(m.it) with funcs = funcs_a; data=m.it.data@new_data;
     globals = List.map (remap_global (fun x -> x) (Hashtbl.find gmap1) (Hashtbl.find gmap2) ftmap1) m.it.globals;
     imports = List.rev !g_imports @ func_imports m @ table @ [elem mem];
     exports = exports_a;
     elems = List.map (remap_elem_segments (fun x -> x) (Hashtbl.find gmap1) (Hashtbl.find gmap2) ftmap1) m.it.elems;
  }}

let export_global m idx name =
   let idx = idx + List.length (global_imports m) in
   do_it m (fun m -> {m with exports=m.exports@[elem {name=Utf8.decode name; edesc=elem (GlobalExport (elem (Int32.of_int idx)))}]})


