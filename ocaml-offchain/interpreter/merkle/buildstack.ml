
(*

Count steps, on each critical step, store local variables 

Perhaps before each step, we should count, instead of entering functions

So also exits are handled

*)

open Ast
open Source
open Types
open Values
open Sourceutil

type ctx = {
  tctx : Valid.context;
  g64 : var;
  (*
  possible : int32 -> bool;
  bottom : int32;
  *)
  count : var; (* count, check if critical  *)
  is_critical : var; (* only check if current would be critical *)
  
  store_arg : var;
  label : int;
  var_type : int32 -> func_type;
  lookup_type : int32 -> func_type;
  store_local_i32 : var;
  store_local_i64 : var;
  store_local_f32 : var;
  store_local_f64 : var;

  store_indirect : var;
  store_call : var;
  store_pc : var;

  adjust_stack_i32 : var;
  adjust_stack_i64 : var;
  adjust_stack_f32 : var;
  adjust_stack_f64 : var;
  
  orig_locals : int;
  params : int;
  
  func_idx : int;
  
  find_return_pc : int32 -> int;
  
}

(* perhaps should get everything as args, just be a C function: add them to env *)

let rec inner_loops inst =
  let loc = Int32.of_int inst.at.left.column in
  match inst.it with
  | Block (ty, lst) -> List.flatten (List.map inner_loops lst)
  | Loop (ty, lst) -> loc :: List.flatten (List.map inner_loops lst)
  | If (ty, l1, l2) -> List.flatten (List.map inner_loops l1) @ List.flatten (List.map inner_loops l2)
  | a -> []

(* for active blocks ... *)

let type_rets = function
 | FuncType (_, lst) -> List.length lst

let type_pops = function
 | FuncType (lst, _) -> List.length lst

let inst_rets ctx = function
  | Block (ty, _) -> List.length ty
  | Loop (ty, _) -> List.length ty
  | If (ty, _, _) -> List.length ty
  | Const _ -> 1
  | Test _ -> 1
  | Compare _ -> 1
  | Unary _ -> 1
  | Binary _ -> 1
  | Convert _ -> 1
  | BrIf _ -> 0
  | BrTable (_, _) -> 0
  | Drop -> 0
  | GrowMemory -> 0
  | CurrentMemory -> 1
  | GetGlobal _ -> 1
  | SetGlobal _ -> 0
  | Call {it=v; _} -> type_rets (ctx.var_type v)
  | CallIndirect {it=v; _} -> type_rets (ctx.lookup_type v)
  | Select -> 1
  | GetLocal _ -> 1
  | SetLocal _ -> 0
  | TeeLocal _ -> 1
  | Load _ -> 1
  | Store _ -> 0
  | _ -> 0

let inst_pops ctx = function
  | Block (ty, _) -> 0
  | Loop (ty, _) -> 0
  | If (ty, _, _) -> 1
  | Const _ -> 0
  | Test _ -> 1
  | Compare _ -> 2
  | Unary _ -> 1
  | Binary _ -> 2
  | Convert _ -> 1
  | BrIf _ -> 1
  | BrTable (_, _) -> 1
  | Drop -> 1
  | GrowMemory -> 1
  | CurrentMemory -> 0
  | GetGlobal _ -> 0
  | SetGlobal _ -> 1
  | Call {it=v; _} -> type_pops (ctx.var_type v)
  | CallIndirect {it=v; _} -> type_pops (ctx.lookup_type v)
  | Select -> 3
  | GetLocal _ -> 0
  | SetLocal _ -> 1
  | TeeLocal _ -> 1
  | Load _ -> 1
  | Store _ -> 2
  | _ -> 0

let determine_type tctx block =
  let _, lst = Valid.type_seq tctx block in
(*  prerr_endline (string_of_int (List.length lst)); *)
  match List.rev lst with
  | Some x :: _ -> x
  | _ -> raise (Failure "typing error")

let store_params ctx =
(*   let num_locals = List.length ctx.tctx.Valid.locals in *)
   let res = ref [] in
   for i = 0 to ctx.params - 1 do
      let var = it (Int32.of_int i) in
      let lst = match Valid.local ctx.tctx var with
      | I32Type -> [GetLocal var; Call ctx.store_local_i32]
      | F32Type -> [GetLocal var; Call ctx.store_local_f32]
      | F64Type -> [GetLocal var; Call ctx.store_local_f64]
      | I64Type -> [Const (it (I32 64l)); GetLocal var; Store {ty=I64Type; align=0; offset=0l; sz=None}; Call ctx.store_local_i64] in
(*      res := !res @ (Const (it (I32 (Int32.of_int i))) :: lst) *)
      res := !res @ lst
   done;
   !res

let store_locals ctx =
(*   let num_locals = List.length ctx.tctx.Valid.locals in *)
   let res = ref [] in
   for i = ctx.params to ctx.orig_locals - 1 do
      let var = it (Int32.of_int i) in
      let lst = match Valid.local ctx.tctx var with
      | I32Type -> [GetLocal var; Call ctx.store_local_i32]
      | F32Type -> [GetLocal var; Call ctx.store_local_f32]
      | F64Type -> [GetLocal var; Call ctx.store_local_f64]
      | I64Type -> [Const (it (I32 64l)); GetLocal var; Store {ty=I64Type; align=0; offset=0l; sz=None}; Call ctx.store_local_i64] in
(*      res := !res @ (Const (it (I32 (Int32.of_int i))) :: lst) *)
      res := !res @ lst
   done;
   !res

let rec remap_blocks label inst =
  let handle {it=v; _} = if Int32.of_int label > v then it v else it (Int32.add v 1l) in
  do_it inst (function
  | Block (ty, lst) -> Block (ty, List.map (remap_blocks (label+1)) lst)
  | If (ty, l1, l2) -> If (ty, List.map (remap_blocks (label+1)) l1, List.map (remap_blocks (label+1)) l2)
  | Loop (ty, lst) -> Loop (ty, List.map (remap_blocks (label+1)) lst)
  | Br v -> Br (handle v)
  | BrIf v -> BrIf (handle v)
  | BrTable (lst, v) -> BrTable (List.map handle lst, handle v)
  | a -> a)

let rec postfix = function
 | [] -> []
 | a::tl -> (tl, a) :: postfix tl

let prefix lst = List.rev (List.map (fun (l, a) -> List.rev l, a) (postfix (List.rev lst)))

let store_top ctx = function
 | I32Type -> [Call ctx.adjust_stack_i32]
 | F32Type -> [Call ctx.adjust_stack_f32]
 | I64Type -> [SetGlobal ctx.g64; Const (it (I32 64l)); GetGlobal ctx.g64; Store {ty=I64Type; align=0; offset=0l; sz=None}; Call ctx.adjust_stack_i64; GetGlobal ctx.g64]
 | F64Type -> [Call ctx.adjust_stack_f64]

let store_hidden ctx id =
  try
    let exprs, _ = Hashtbl.find Secretstack.info id in
    let dta = List.nth !Secretstack.func_info ctx.func_idx in
    let handle e_id =
      let (ty, var) = List.assoc e_id dta in
      match ty with
      | I32Type -> [GetLocal var; Call ctx.store_local_i32]
      | F32Type -> [GetLocal var; Call ctx.store_local_f32]
      | F64Type -> [GetLocal var; Call ctx.store_local_f64]
      | I64Type -> [Const (it (I32 64l)); GetLocal var; Store {ty=I64Type; align=0; offset=0l; sz=None}; Call ctx.store_local_i64] in
    List.flatten (List.map handle exprs)
  with Not_found -> []

let rec process_inst ctx inst =
  let id = Int32.of_int inst.at.right.line in
  let i_loc =
     try ctx.find_return_pc id
     with Not_found -> 0 in
  let s_block_loop () =
    [Call ctx.count; If ([], List.map it (store_locals ctx @ [Const (it (I32 (Int32.of_int i_loc))); Call ctx.store_pc]), [])] in
  let s_block_call () =
    [Call ctx.count; If ([], List.map it (store_locals ctx @ store_hidden ctx id @ [Const (it (I32 (Int32.of_int i_loc))); Call ctx.store_call; Const (it (I32 (Int32.of_int (i_loc-2)))); Call ctx.store_pc]), [])] in
  let s_block_calli () =
    [Call ctx.count; If ([], List.map it (store_locals ctx @ store_hidden ctx id @ [Const (it (I32 (Int32.of_int i_loc))); Call ctx.store_call; Const (it (I32 (Int32.of_int (i_loc-2)))); Call ctx.store_pc]), [])] in
  let s_block_return () =
    [Call ctx.count; If ([], List.map it (store_locals ctx @ store_hidden ctx id @ [Const (it (I32 (Int32.of_int i_loc))); Call ctx.store_pc]), [])] in
  let e_block call = function
   | FuncType (_, []) -> [call]
   | FuncType (_, [ty]) -> call :: store_top ctx ty (* adjust stack will have to check if it is critical *)
   | _ -> raise (Failure "bad function return type") in
  let it x = {at=inst.at; it=x} in
  (* *)
  let res = match inst.it with
  | Block (ty, lst) -> [Block (ty, List.flatten (List.map (process_inst ctx) lst))]
  | If (ty, l1, l2) -> [If (ty, List.flatten (List.map (process_inst ctx) l1), List.flatten (List.map (process_inst ctx) l2))]
  | Loop (ty, lst) -> [Loop (ty, List.map it (s_block_loop ()) @ List.flatten (List.map (process_inst ctx) lst))]
  (* Just before call, store all locals (arguments will be stored later, but what if builtin) *)
  | Call x -> s_block_call () @ e_block (Call x) (ctx.var_type x.it) @ s_block_return ()
  | CallIndirect x -> (* prerr_endline ("at call " ^ Int32.to_string id); *) s_block_calli () @ [Call ctx.store_indirect] @ e_block (CallIndirect x) (ctx.lookup_type x.it) @ s_block_return ()
  | a -> [a] in
  List.map it res

let fnum = ref 0

let process_function ctx f =
  let loc = Int32.of_int f.at.left.column in
  prerr_endline ("Function " ^ string_of_int !fnum ^ " is at " ^ Int32.to_string loc);
  incr fnum;
  let ctx = {ctx with tctx=Valid.func_context ctx.tctx f} in
  (* let FuncType (_, rets) = ctx.lookup_type f.it.ftype.it in *)
  let s_block = List.map it [
     Call ctx.store_arg; If ([], List.map it (store_params ctx), [])
  ] in
  do_it f (fun f -> {f with body=s_block @ List.flatten (List.map (process_inst ctx) f.body)})

let path_table fn =
  let open Yojson.Basic in
  let data = from_channel (open_in fn) in
  let lst = Util.to_list data in
  List.map (fun el ->
     let loc = Util.member "loc" el in
     Int32.of_int (Util.to_int loc)) lst

let list_to_map lst =
  let res = Hashtbl.create 123 in
  List.iter (fun el -> Hashtbl.add res el true) lst;
  res

let process m_orig =
  let m = Secretstack.relabel m_orig in
  Flags.br_mode := true;
  let code = Run.get_code m in
  let return_pc = Hashtbl.create 100 in
  let handle i = function
   | Merkle.BREAKPOINT id -> Hashtbl.add return_pc id i
   | Merkle.CALL (_, id) -> Hashtbl.add return_pc id i
   | Merkle.CALLI id -> Hashtbl.add return_pc id i (* ; prerr_endline ("adding " ^ Int32.to_string id) *)
   | _ -> () in
  List.iteri handle code;
  let m = Secretstack.process m in
  let _, ttab = make_tables m.it in
  let orig_locals = List.map (fun f ->
      let FuncType (par,_) = Hashtbl.find ttab f.it.ftype.it in
      List.length f.it.locals + List.length par) m_orig.it.funcs in
  let f_params = List.map (fun f ->
      let FuncType (par,_) = Hashtbl.find ttab f.it.ftype.it in
      List.length par) m_orig.it.funcs in
  (* Information about hidden variables is at [Secretstack.info] *)
  do_it m (fun m ->
    (* add function types *)
    let i_num = List.length (func_imports (it m)) in
    let ftypes = m.types @ [
      it (FuncType ([], [I32Type]));
      it (FuncType ([I32Type], []));
      it (FuncType ([], []));
      it (FuncType ([F32Type], []));
      it (FuncType ([F64Type], []));
      
      it (FuncType ([I32Type], [I32Type]));
      it (FuncType ([], []));
      it (FuncType ([F32Type], [F32Type]));
      it (FuncType ([F64Type], [F64Type]));
      ] in
    let ftypes_len = List.length m.types in
    let count_type = it (Int32.of_int ftypes_len) in
    let store_type_i32 = it (Int32.of_int (ftypes_len+1)) in
    let store_type_i64 = it (Int32.of_int (ftypes_len+2)) in
    let store_type_f32 = it (Int32.of_int (ftypes_len+3)) in
    let store_type_f64 = it (Int32.of_int (ftypes_len+4)) in
    
    let adjust_stack_i32 = it (Int32.of_int (ftypes_len+5)) in
    let adjust_stack_i64 = it (Int32.of_int (ftypes_len+6)) in
    let adjust_stack_f32 = it (Int32.of_int (ftypes_len+7)) in
    let adjust_stack_f64 = it (Int32.of_int (ftypes_len+8)) in
    
    (* add imports *)
    let added = [
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "countStep"; idesc=it (FuncImport count_type)};
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storeArg"; idesc=it (FuncImport count_type)};
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storeLocalI32"; idesc=it (FuncImport store_type_i32)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storeLocalI64"; idesc=it (FuncImport store_type_i64)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storeLocalF32"; idesc=it (FuncImport store_type_f32)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storeLocalF64"; idesc=it (FuncImport store_type_f64)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "adjustStackI32"; idesc=it (FuncImport adjust_stack_i32)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "adjustStackI64"; idesc=it (FuncImport adjust_stack_i64)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "adjustStackF32"; idesc=it (FuncImport adjust_stack_f32)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "adjustStackF64"; idesc=it (FuncImport adjust_stack_f64)}; (* for each type, need a different function *)
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "testStep"; idesc=it (FuncImport count_type)};
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storeIndirect"; idesc=it (FuncImport adjust_stack_i32)};
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storeReturnPC"; idesc=it (FuncImport store_type_i32)};
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "storePC"; idesc=it (FuncImport store_type_i32)};
    ] in
    let imps = m.imports @ added in
    (*
    let pos_lst = path_table "critical.out" in
    let pos_tab = list_to_map pos_lst in
    *)
    (* remap calls *)
    let remap x = let x = Int32.to_int x in if x >= i_num then Int32.of_int (x + List.length added) else Int32.of_int x in
    let funcs = List.map (Merge.remap remap (fun x -> x) (fun x -> x)) m.funcs in
    let pre_m = {m with funcs=funcs;
            types=ftypes;
            imports=imps;
            globals=m.globals @ [it {gtype=GlobalType (I64Type, Mutable); value=it [it (Const (it (I64 0L)))]}];
            exports=List.map (Merge.remap_export remap (fun x -> x) (fun x -> x) "") m.exports;
            elems=List.map (Merge.remap_elements remap) m.elems; } in
    let ftab, ttab = make_tables pre_m in
    let ctx = {
      g64 = it (Int32.of_int (List.length m.globals));
      tctx = Valid.module_context (it pre_m);
      count = it (Int32.of_int (i_num+0));
      store_arg = it (Int32.of_int (i_num+1));
      store_local_i32 = it (Int32.of_int (i_num+2));
      store_local_i64 = it (Int32.of_int (i_num+3));
      store_local_f32 = it (Int32.of_int (i_num+4));
      store_local_f64 = it (Int32.of_int (i_num+5));
      adjust_stack_i32 = it (Int32.of_int (i_num+6));
      adjust_stack_i64 = it (Int32.of_int (i_num+7));
      adjust_stack_f32 = it (Int32.of_int (i_num+8));
      adjust_stack_f64 = it (Int32.of_int (i_num+9));
      is_critical = it (Int32.of_int (i_num+10));
      store_indirect = it (Int32.of_int (i_num+11));
      store_call = it (Int32.of_int (i_num+12));
      store_pc = it (Int32.of_int (i_num+13));
      var_type = Hashtbl.find ftab;
      lookup_type = Hashtbl.find ttab;
      (* possible = (fun loc -> Hashtbl.mem pos_tab loc);
      bottom = List.hd (List.rev pos_lst); *)
      label = 0;
      orig_locals = 0;
      params = 0;
      func_idx = 0;
      find_return_pc = (fun x -> Hashtbl.find return_pc x);
    } in
    let res = {pre_m with funcs=List.mapi (fun i f -> process_function {ctx with orig_locals=List.nth orig_locals i; params=List.nth f_params i; func_idx=i} f) pre_m.funcs} in
    res)

