
open Ast
open Source
open Types
open Sourceutil

(* Analyze stack *)

type control = {
  rets : int;
  level : int;
}

type context = {
  ptr : int;
  locals : int;
  bptr : int;
  stack : Int32.t list;
  f_types : (Int32.t, func_type) Hashtbl.t;
  f_types2 : (Int32.t, func_type) Hashtbl.t;
  block_return : control list;
  mutable marked : Int32.t list;
  tctx : Valid.context;
}

(* Associating instructions with types *)
let assoc_types ctx func =
  let res = Hashtbl.create 10 in
  let ctx = Valid.func_context ctx func in
  let rec compile pre (expr:instr) =
     compile' pre expr.it;
     let _, typ3 = Valid.type_seq ctx (pre@[expr]) in
     Hashtbl.add res (Int32.of_int expr.at.right.line) typ3
  and compile' pre = function
    | Block (ty, lst) -> compile_list lst
    | Loop (ty, lst) -> compile_list lst
    | If (ty, texp, fexp) -> compile_list texp; compile_list fexp
    | _ -> ()
  and compile_list lst = compile_list_aux [] lst
  and compile_list_aux pre = function
    | a::tl -> compile pre a; compile_list_aux (pre@[a]) tl
    | [] -> () in
  compile_list func.it.body;
  res

(* the idea would be to add local variables so that there are never hidden elements in the stack when making a call *)

let una_stack id x = {x with stack=id::popn 1 x.stack}
let bin_stack id x = {x with stack=id::popn 2 x.stack}
let n_stack n id x = {x with stack=id::popn n x.stack}

let info = Hashtbl.create 100

let rec compile marked (ctx : context) expr = compile' marked ctx (Int32.of_int expr.at.right.line) expr.it
and compile' marked ctx id = function
 | Block (ty, lst) ->
   let rets = List.length ty in
   let extra = ctx.ptr - ctx.locals in
   if extra > 0 then trace ("block start " ^ string_of_int extra);
   let old_return = ctx.block_return in
   let old_ptr = ctx.ptr in
   let old_stack = ctx.stack in
   let ctx = {ctx with bptr=ctx.bptr+1; block_return={level=old_ptr+rets; rets=rets}::ctx.block_return} in
   let ctx = compile_block marked ctx lst in
   if extra > 0 then trace ("block end");
   {ctx with bptr=ctx.bptr-1; block_return=old_return; ptr=old_ptr+rets; stack=make id rets @ old_stack}
 (* Loops have no return types currently *)
 | Loop (_, lst) ->
   let old_return = ctx.block_return in
   let extra = ctx.ptr - ctx.locals in
   (* we should mark the extra here, too *)
   if extra > 0 then begin
      trace ("loop start " ^ string_of_int extra);
      let hidden = take extra ctx.stack in
      marked := hidden @ !marked;
      Hashtbl.add info id (hidden, 0);
   end;
   let ctx = {ctx with bptr=ctx.bptr+1; block_return={level=ctx.ptr; rets=0}::old_return} in
   let ctx = compile_block marked ctx lst in
   if extra > 0 then trace ("loop end " ^ string_of_int extra);
   {ctx with bptr=ctx.bptr-1; block_return=old_return}
 | Call v ->
   (* Will just push the pc *)
   let FuncType (par,ret) = Hashtbl.find ctx.f_types v.it in
   let extra = ctx.ptr - ctx.locals - List.length par in
   if extra > 0 then begin
      trace ("call " ^ string_of_int extra);
      let hidden = take extra (popn (List.length par) ctx.stack) in
      marked := hidden @ !marked;
      Hashtbl.add info id (hidden, List.length par);
   end;
   {ctx with ptr=ctx.ptr+List.length ret-List.length par; stack=make id (List.length ret) @ popn (List.length par) ctx.stack}
 | CallIndirect v ->
   let FuncType (par,ret) = Hashtbl.find ctx.f_types2 v.it in
   let extra = ctx.ptr - ctx.locals - List.length par - 1 in
   if extra > 0 then begin
      trace ("calli " ^ string_of_int extra ^ " adding info for " ^ Int32.to_string id);
      let hidden = take extra (popn (List.length par+1) ctx.stack) in
      marked := hidden @ !marked;
      Hashtbl.add info id (hidden, List.length par+1);
   end;
   {ctx with ptr=ctx.ptr+List.length ret-List.length par-1; stack=make id (List.length ret) @ popn (List.length par + 1) ctx.stack}
 | If (ty, texp, fexp) ->
   let a_ptr = ctx.ptr-1 in
   let ctx = {ctx with ptr=a_ptr} in
   let ctx = compile' marked ctx id (Block (ty, texp)) in
   let ctx = compile' marked {ctx with ptr=a_ptr} id (Block (ty, fexp)) in
   ctx
 | Const lit -> {ctx with ptr = ctx.ptr+1; stack=id::ctx.stack}
 | Test t -> una_stack id ctx
 | Compare i -> bin_stack id {ctx with ptr = ctx.ptr-1}
 | Unary i -> una_stack id ctx
 | Binary i -> bin_stack id {ctx with ptr = ctx.ptr-1}
 | Convert i -> una_stack id ctx
 | Unreachable -> ctx
 | Nop -> ctx
 (* breaks might be used to return values, check this *)
 | Br x ->
   let num = Int32.to_int x.it in
   let c = List.nth ctx.block_return num in
   {ctx with ptr=ctx.ptr - c.rets; stack=popn c.rets ctx.stack}
 | BrIf x ->
   {ctx with ptr = ctx.ptr-1; stack=popn 1 ctx.stack}
 | BrTable (tab, def) ->
   let num = Int32.to_int def.it in
   let { rets; _ } = List.nth ctx.block_return num in
   {ctx with ptr = ctx.ptr-1-rets; stack=popn (rets+1) ctx.stack}
 | Return ->
   let num = ctx.bptr-1 in
   let {level=ptr; rets} = List.nth ctx.block_return num in
   {ctx with ptr=ctx.ptr - rets}
 | Drop -> {ctx with ptr=ctx.ptr-1}
 | GrowMemory -> {ctx with ptr=ctx.ptr-1; stack=popn 1 ctx.stack}
 | CurrentMemory -> {ctx with ptr=ctx.ptr+1; stack=id::ctx.stack}
 | GetGlobal x -> {ctx with ptr=ctx.ptr+1; stack=id::ctx.stack}
 | SetGlobal x -> {ctx with ptr=ctx.ptr-1; stack=popn 1 ctx.stack}
 | Select -> n_stack 3 id {ctx with ptr=ctx.ptr-2}
 | GetLocal v -> {ctx with ptr=ctx.ptr+1; stack=id::ctx.stack}
 | SetLocal v -> {ctx with ptr=ctx.ptr-1; stack=popn 1 ctx.stack}
 | TeeLocal v -> una_stack id ctx
 | Load op -> una_stack id ctx
 | Store op -> bin_stack id {ctx with ptr=ctx.ptr-2}

and compile_block marked ctx = function
 | [] -> ctx
 | a::tl ->
    let ctx = compile marked ctx a in
    let ctx = compile_block marked ctx tl in
    ctx

let tee_locals assoc func =
  let rec compile (expr:instr) = List.map (fun e -> {expr with it=e}) (compile' (Int32.of_int expr.at.right.line) expr.it)
  and compile' numm = function
    | Block (ty, lst) -> [Block (ty, compile_list lst)]
    | Loop (ty, lst) -> [Loop (ty, compile_list lst)]
    | If (ty, texp, fexp) -> [If (ty, compile_list texp, compile_list fexp)]
    | a ->
       ( try
           let (_, num) = List.assoc numm assoc in
           [a; TeeLocal num]
         with Not_found -> [a] )
  and compile_list lst = List.flatten (List.map compile lst) in
  compile_list func.it.body

let func_info = ref []

let compile_func ctx func =
  let FuncType (par,ret) = Hashtbl.find ctx.f_types2 func.it.ftype.it in
  trace ("---- function start params:" ^ string_of_int (List.length par) ^ " locals: " ^ string_of_int (List.length func.it.locals));
  (* Just params are now in the stack *)
  let locals = List.length par + List.length func.it.locals in
  let res = assoc_types (Valid.func_context ctx.tctx func) func in
  let marked = ref [] in
  let ctx = compile' marked {ctx with ptr=locals; locals=locals} 0l (Block (ret, func.it.body)) in
  (* find types for marked expressions *)
  let find_type expr =
     try match Hashtbl.find res expr with
      | Some x :: _ -> trace ("found type " ^ type_to_str x ^ " for " ^ Int32.to_string expr) ; x
      | _ -> trace ("Warning: empty type") ; raise Not_found
     with Not_found -> ( trace ("Warning: cannot find type") ; I32Type)
     in
  (* Association list from expression ids to local variables *)
  let marked = List.mapi (fun i x -> x, (find_type x, {it=Int32.of_int (i+locals); at=no_region})) !marked in
  trace ("---- function end " ^ string_of_int ctx.ptr);
  func_info := !func_info @ [marked];
  do_it func (fun f -> {f with locals=f.locals@List.map (fun (_,(t,_)) -> t) marked; body=tee_locals marked func})

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

let relabel m =
  do_it m (fun m ->
     {m with funcs=List.map (fun func -> do_it func (fun f -> {f with body=relabel f.body})) m.funcs})

let process m_ =
  Hashtbl.clear info;
  func_info := [];
  do_it m_ (fun m ->
     let ftab, ttab = make_tables m in
     let ctx = {
        ptr=0; bptr=0; block_return=[]; 
        f_types2=ttab; f_types=ftab;
        locals=0; stack=[]; marked=[];
        tctx = Valid.module_context m_ } in
     {m with funcs=List.map (fun x -> compile_func ctx x) m.funcs})

