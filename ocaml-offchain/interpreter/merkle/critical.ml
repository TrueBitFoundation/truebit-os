
open Ast
open Source
open Types
open Values
open Sourceutil

(*
type ctx = {
  stepper : Int32.t; (* number of steps taken *)
  pointer : Int32.t; (* stack pointer *)
  target : Int32.t; (* target step *)
}*)

type ctx = {
  enter_loop : var;
  push_func : var;
(*  enter_func : var; *)
  pop : var;
  loc : Int32.t;
  f_loops : Int32.t list;
}

(* perhaps should get everything as args, just be a C function: add them to env *)

(* for each block, find all loops, after block check if that loop exited *)

let rec process_inst ctx inst =
  let loc = Int32.of_int inst.at.left.column in
  let res = match inst.it with
  | Block (ty, lst) -> [Block (ty, List.flatten (List.map (process_inst ctx) lst))]
  | If (ty, l1, l2) -> [If (ty, List.flatten (List.map (process_inst ctx) l1), List.flatten (List.map (process_inst ctx) l2))]
  | Loop (ty, lst) -> [Loop (ty, List.map it [Call ctx.enter_loop] @ List.flatten (List.map (process_inst ctx) lst))]
  | Call x -> [Const (it (I32 loc)); Call ctx.push_func; Call x; Const (it (I32 loc)); Call ctx.pop]
  | CallIndirect x -> [Const (it (I32 loc)); Call ctx.push_func; CallIndirect x; Const (it (I32 loc)); Call ctx.pop]
  | a -> [a] in
  List.map it res

let process_function ctx f =
  let loc = Int32.of_int f.at.left.column in
  let ctx = {ctx with loc=loc} in
  do_it f (fun f ->
    {f with body= (* List.map it [Const (it (I32 loc)); Call ctx.push_func] @ *) List.flatten (List.map (process_inst ctx) f.body)})

let process m =
(*
  let m = Secretstack.relabel m in
  let m = Secretstack.process m in
*)
  do_it m (fun m ->
    (* add function types *)
    let i_num = List.length (func_imports (it m)) in
    let ftypes = m.types @ [
       it (FuncType ([], [I32Type]));
       it (FuncType ([I32Type], []));
       it (FuncType ([], []));
       it (FuncType ([I32Type; I32Type], []));
       it (FuncType ([I32Type; I32Type], [I32Type]));
       ] in
    let ftypes_len = List.length m.types in
    let set_type = it (Int32.of_int (ftypes_len+1)) in
    let pop_type = it (Int32.of_int (ftypes_len+2)) in
    (* add imports *)
    let added = [
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "popFuncCritical"; idesc=it (FuncImport set_type)};
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "enterLoopCritical"; idesc=it (FuncImport pop_type)};
       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "pushFuncCritical"; idesc=it (FuncImport set_type)};
(*       it {module_name=Utf8.decode "env"; item_name=Utf8.decode "enterFuncCritical"; idesc=it (FuncImport pop_type)}; *)
    ] in
    let imps = m.imports @ added in
    let ctx = {
      pop = it (Int32.of_int (i_num+0));
      enter_loop = it (Int32.of_int (i_num+1));
      push_func = it (Int32.of_int (i_num+2));
(*      enter_func = it (Int32.of_int (i_num+3)); *)
      f_loops = [];
      loc = 0l;
    } in
    (* remap calls *)
    let remap x = let x = Int32.to_int x in if x >= i_num then Int32.of_int (x + List.length added) else Int32.of_int x in
    let funcs = List.map (Merge.remap remap (fun x -> x) (fun x -> x)) m.funcs in
    {m with funcs=List.map (process_function ctx) funcs;
            types=ftypes;
            imports=imps;
            exports=List.map (Merge.remap_export remap (fun x -> x) (fun x -> x) "") m.exports;
            elems=List.map (Merge.remap_elements remap) m.elems; }
(*
    {m with funcs=funcs; types=ftypes; imports=imps; elems=List.map (Merge.remap_elements remap) m.elems; exports = List.map (Merge.remap_export remap (fun x -> x) (fun x -> x) "") m.exports}
    {m with types=ftypes } 
    m
    *)
    )

