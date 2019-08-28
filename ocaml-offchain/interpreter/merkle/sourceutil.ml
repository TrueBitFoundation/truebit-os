open Ast
open Source
open Types
open Values

(* Analyze stack *)

let do_it x f = {x with it=f x.it}

let it e = {it=e; at=no_region}

let uniq = ref 1

let relabel lst =
   let rec compile expr =
      incr uniq;
      {it=compile' expr.it; at={left=no_pos; right={file="label"; line= !uniq; column=0}}}
   and compile' = function
    | Block (ty, lst) -> Block (ty, List.map compile lst)
    | Loop (ty, lst) -> Loop (ty, List.map compile lst)
    | If (ty, texp, fexp) -> If (ty, List.map compile texp, List.map compile fexp)
    | a -> a in
  List.map compile lst

let rec popn n = function
 | a::tl when n > 0 -> popn (n-1) tl
 | lst -> lst

let rec take n = function
 | a::tl when n > 0 -> a :: take (n-1) tl
 | lst -> []

let rec gen n a = if n = 0 then [] else a (n-1) :: gen (n-1) a

let value_bool v = not (v = I32 0l || v = I64 0L)

let value_to_int = function
 | I32 i -> Int32.to_int i
 | I64 i -> Int64.to_int i
 | _ -> 0

let value_to_int64 = function
 | I32 i -> Int64.of_int32 i
 | I64 i -> i
 | _ -> 0L

let i x = I32 (Int32.of_int x)

let is_float_op = function
 | I32 _ | I64 _ -> false
 | _ -> true

let req_type = function
 | I32 I32Op.ExtendSI32 -> I32Type
 | I32 I32Op.ExtendUI32 -> I32Type
 | I32 I32Op.WrapI64 -> I64Type
 | I32 I32Op.TruncSF32 -> F32Type
 | I32 I32Op.TruncUF32 -> F32Type
 | I32 I32Op.TruncSF64 -> F64Type
 | I32 I32Op.TruncUF64 -> F64Type
 | I32 I32Op.ReinterpretFloat -> F32Type
 | I64 I64Op.ExtendSI32 -> I32Type
 | I64 I64Op.ExtendUI32 -> I32Type
 | I64 I64Op.WrapI64 -> I64Type
 | I64 I64Op.TruncSF32 -> F32Type
 | I64 I64Op.TruncUF32 -> F32Type
 | I64 I64Op.TruncSF64 -> F64Type
 | I64 I64Op.TruncUF64 -> F64Type
 | I64 I64Op.ReinterpretFloat -> F64Type
 | F32 F32Op.ConvertSI32 -> I32Type
 | F32 F32Op.ConvertUI32 -> I32Type
 | F32 F32Op.ConvertSI64 -> I64Type
 | F32 F32Op.ConvertUI64 -> I64Type
 | F32 F32Op.PromoteF32 -> F32Type
 | F32 F32Op.DemoteF64 -> F64Type
 | F32 F32Op.ReinterpretInt -> I32Type
 
 | F64 F64Op.ConvertSI32 -> I32Type
 | F64 F64Op.ConvertUI32 -> I32Type
 | F64 F64Op.ConvertSI64 -> I64Type
 | F64 F64Op.ConvertUI64 -> I64Type
 | F64 F64Op.PromoteF32 -> F32Type
 | F64 F64Op.DemoteF64 -> F64Type
 | F64 F64Op.ReinterpretInt -> I64Type

let rec make a n = if n = 0 then [] else a :: make a (n-1) 

let trace = Byteutil.trace

let make_tables m =
  let ftab = Hashtbl.create 10 in
  let ttab = Hashtbl.create 10 in
  List.iteri (fun i f -> Hashtbl.add ttab (Int32.of_int i) f.it) m.types;
  let rec get_imports i = function
   | [] -> []
   | {it=im; _} :: tl ->
     match im.idesc.it with
     | FuncImport tvar ->
        let ty = Hashtbl.find ttab tvar.it in
        Hashtbl.add ftab (Int32.of_int i) ty;
        im :: get_imports (i+1) tl
     | _ -> get_imports i tl in
  let f_imports = get_imports 0 m.imports in
  let num_imports = List.length f_imports in
  List.iteri (fun i f ->
    let ty = Hashtbl.find ttab f.it.ftype.it in
    Hashtbl.add ftab (Int32.of_int (i + num_imports)) ty) m.funcs;
  ftab, ttab

let elem x = {it=x; at=no_region}

let func_imports m =
  let rec do_get = function
   | [] -> []
   | ({it={idesc={it=FuncImport _;_};_};_} as el)::tl -> el :: do_get tl
   | _::tl -> do_get tl in
  do_get m.it.imports

let global_imports m =
  let rec do_get = function
   | [] -> []
   | ({it={idesc={it=GlobalImport _;_};_};_} as el)::tl -> el :: do_get tl
   | _::tl -> do_get tl in
  do_get m.it.imports

let other_imports m =
  let rec do_get = function
   | [] -> []
   | {it={idesc={it=FuncImport _;_};_};_}::tl -> do_get tl
   | {it={idesc={it=GlobalImport _;_};_};_}::tl -> do_get tl
   | el::tl -> el :: do_get tl in
  do_get m.it.imports

let other_imports_nomem m =
  let rec do_get = function
   | [] -> []
   | {it={idesc={it=FuncImport _;_};_};_}::tl -> do_get tl
   | {it={idesc={it=GlobalImport _;_};_};_}::tl -> do_get tl
   | {it={idesc={it=MemoryImport _;_};_};_}::tl -> do_get tl
   | el::tl -> el :: do_get tl in
  do_get m.it.imports

let find_function m func =
  let ftab = Hashtbl.create 10 in
  let ttab = Hashtbl.create 10 in
  List.iteri (fun i f -> Hashtbl.add ttab (Int32.of_int i) f.it) m.types;
  let rec get_imports i = function
   | [] -> []
   | {it=im; _} :: tl ->
     match im.idesc.it with
     | FuncImport tvar ->
        let ty = Hashtbl.find ttab tvar.it in
        Hashtbl.add ftab (Int32.of_int i) ty;
        im :: get_imports (i+1) tl
     | _ -> get_imports i tl in
  let num_imports = List.length (get_imports 0 m.imports) in
  let entry = ref (-1) in
  List.iteri (fun i f ->
    if f = func then ( entry := i + num_imports )) m.funcs;
  !entry

let find_function_index m inst name =
  ( match Instance.export inst name with
  | Some (Instance.ExternalFunc (Instance.AstFunc (_, func))) -> find_function m func
  | _ -> raise Not_found )

let find_global_index m name =
  let num_imports = 0l (* Int32.of_int (List.length (global_imports m)) *) in
  let rec get_exports = function
   | [] -> trace ("Cannot Find global: " ^ Utf8.encode name); raise Not_found
   | {it=im; _} :: tl ->
     match im.edesc.it with
     | GlobalExport tvar -> if im.name = name then Int32.add tvar.it num_imports else get_exports tl
     | _ -> get_exports tl in
  Int32.to_int (get_exports m.it.exports)

let type_to_str = function
 | I32Type -> "i32"
 | I64Type -> "i64"
 | F32Type -> "f32"
 | F64Type -> "f64"


let int_const y = Const (elem (Values.I32 (Int32.of_int y)))
let int64_const y = Const (elem (Values.I64 y))
let f64_const y = Const (elem (Values.F64 y))

let int_binary i =
  let res = Bytes.create 4 in
  Bytes.set res 0 (Char.chr (i land 0xff));
  Bytes.set res 1 (Char.chr ((i lsr 8) land 0xff));
  Bytes.set res 2 (Char.chr ((i lsr 16) land 0xff));
  Bytes.set res 3 (Char.chr ((i lsr 24) land 0xff));
  Bytes.to_string res

let generate_data (addr, i) : string segment =
  elem {
    offset=elem [elem (int_const (addr*4))];
    index=elem 0l;
    init=int_binary i;
  }

let add_i32_global m name tmem =
  let open Types in
  let idx = Int32.of_int (List.length (global_imports m) + List.length m.it.globals) in
  do_it m (fun m -> {m with
    globals=m.globals@[elem {value=elem [elem (int_const tmem)]; gtype=GlobalType (I32Type, Immutable)}];
    exports=m.exports@[elem {name=Utf8.decode name; edesc=elem (GlobalExport (elem idx))}]})

let add_i64_global m name tmem =
  let open Types in
  let idx = Int32.of_int (List.length (global_imports m) + List.length m.it.globals) in
  do_it m (fun m -> {m with
    globals=m.globals@[elem {value=elem [elem (int64_const tmem)]; gtype=GlobalType (I64Type, Immutable)}];
    exports=m.exports@[elem {name=Utf8.decode name; edesc=elem (GlobalExport (elem idx))}]})

let add_f64_global m name tmem =
  let open Types in
  let idx = Int32.of_int (List.length (global_imports m) + List.length m.it.globals) in
  do_it m (fun m -> {m with
    globals=m.globals@[elem {value=elem [elem (f64_const tmem)]; gtype=GlobalType (F64Type, Immutable)}];
    exports=m.exports@[elem {name=Utf8.decode name; edesc=elem (GlobalExport (elem idx))}]})

let has_import m name =
  List.exists (fun im -> Utf8.encode im.it.item_name = name) m.it.imports


