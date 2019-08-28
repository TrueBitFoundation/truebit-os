
(* interpreter with merkle proofs *)

open Ast
open Source
open Types
open Values
open Sourceutil

let (@) a b = List.rev_append (List.rev a) b

(* call name to custom judge number *)
let custom_calls = Hashtbl.create 7

let _ =
  Hashtbl.add custom_calls "_readBlock" 1;
  Hashtbl.add custom_calls "_internalStep" 2

(* perhaps we need to link the modules first *)

(* have a separate call stack? *)

(* perhaps the memory will include the stack? nope *)

type inst =
 | EXIT
 | UNREACHABLE
 | NOP
 | JUMP of int
 | JUMPI of int
 | JUMPZ of int
 | JUMPFORWARD of int (* size of jump table *)
 | CALL of int * Int32.t
 | LABEL of int
 | RETURN
 | LOAD of loadop
 | STORE of storeop
 | DROP of int
 | DROP_N
 | DUP of int
 | SWAP of int              (* TODO: doesn't really swap, just pushes deep into stack. change the name *)
 | LOADGLOBAL of int
 | STOREGLOBAL of int
 | CURMEM
 | GROW                     (* Grow memory *)
 | CALLI of Int32.t                   (* indirect call (extra ID) *)
 | CHECKCALLI of Int64.t    (* check type of indirect call *)
 | PUSH of value                  (* constant *)
 | TEST of testop                    (* numeric test *)
 | CMP of relop                  (* numeric comparison *)
 | UNA of unop                     (* unary numeric operator *)
 | BIN of binop                   (* binary numeric operator *)
 | CONV of cvtop
 | STUB of string
 | INPUTSIZE
 | INPUTNAME
 | INPUTDATA
 | OUTPUTSIZE (* this will create the new file? *)
 | OUTPUTNAME
 | OUTPUTDATA
 | INITCALLTABLE of int
 | INITCALLTYPE of int
 | SETSTACK of int
 | SETCALLSTACK of int
 | SETTABLE of int
 | SETGLOBALS of int
 | SETMEMORY of int
 | CUSTOM of int
 | BREAKPOINT of Int32.t

type control = {
  target : int;
  rets : int;
  level : int;
}

type context = {
  ptr : int;
  bptr : int;
  label : int;
  f_types : (Int32.t, func_type) Hashtbl.t;
  f_types2 : (Int32.t, func_type) Hashtbl.t;
  block_return : control list;
  mdle : Ast.module_';
  add_points : bool;
}

(* Push the break points to stack? they can have own stack, also returns will have the same *)

let rec adjust_stack_aux diff num =
  if num = 0 then [] else
  begin
    [DUP num; SWAP (diff + num + 1); DROP 1] @ adjust_stack_aux diff (num-1)
  end

let adjust_stack diff num =
  if diff = 0 then [] else
  if diff < 0 then ( trace "Cannot adjust" ; [] ) else
  ( (* trace ("Adjusting stack: " ^ string_of_int num  ^ " return values, " ^ string_of_int diff ^ " extra values"); *)
    adjust_stack_aux diff num @ [DROP diff] )

let rec compile ctx expr = compile' ctx (Int32.of_int expr.at.right.line) expr.it
and compile' ctx id = function
 | Unreachable ->
   ctx, [UNREACHABLE]
 | Nop ->
   ctx, [NOP]
 | Block (ty, lst) ->
   let rets = List.length ty in
   (* trace ("block start " ^ string_of_int ctx.ptr); *)
   let end_label = ctx.label in
   let old_return = ctx.block_return in
   let old_ptr = ctx.ptr in
   let ctx = {ctx with label=ctx.label+1; bptr=ctx.bptr+1; block_return={level=old_ptr+rets; rets=rets; target=end_label}::ctx.block_return} in
   let ctx, body = compile_block ctx lst in
   (* trace ("block end " ^ string_of_int ctx.ptr); *)
   {ctx with bptr=ctx.bptr-1; block_return=old_return; ptr=old_ptr+rets}, body @ [LABEL end_label]
 | Const lit -> {ctx with ptr = ctx.ptr+1}, [PUSH lit.it]
 | Test i ->
    if is_float_op i && !Flags.disable_float then ctx, [UNREACHABLE] else
    ctx, [TEST i]
 | Compare i ->
   (* trace "cmp"; *)
    if is_float_op i && !Flags.disable_float then {ctx with ptr = ctx.ptr-1}, [UNREACHABLE] else
    {ctx with ptr = ctx.ptr-1}, [CMP i]
 | Unary i ->
    if is_float_op i && !Flags.disable_float then ctx, [UNREACHABLE] else
    ctx, [UNA i]
 | Binary i -> 
   (* trace "bin"; *)
    if is_float_op i && !Flags.disable_float then {ctx with ptr = ctx.ptr-1}, [UNREACHABLE] else
    {ctx with ptr = ctx.ptr-1}, [BIN i]
 | Convert i ->
    let rt = req_type i in
    if (is_float_op i || rt = F32Type || rt = F64Type) && !Flags.disable_float then ctx, [UNREACHABLE] else
    ctx, [CONV i]
 | Loop (ty, lst) ->
   let rets = List.length ty in
   let start_label = ctx.label in
   let old_return = ctx.block_return in
   (* trace ("loop start " ^ string_of_int ctx.ptr); *)
   let ctx = {ctx with label=ctx.label+1; bptr=ctx.bptr+1; block_return={level=ctx.ptr+rets; rets=rets; target=start_label}::old_return} in
   let ctx, body = compile_block ctx lst in
   (* trace ("loop end " ^ string_of_int ctx.ptr); *)
   {ctx with bptr=ctx.bptr-1; block_return=old_return}, [LABEL start_label] @ ( if ctx.add_points then [BREAKPOINT id] else [] ) @ body
 | If (ty, texp, fexp) ->
   (* trace ("if " ^ string_of_int ctx.ptr); *)
   let else_label = ctx.label in
   let end_label = ctx.label+1 in
   let a_ptr = ctx.ptr-1 in
   let ctx = {ctx with ptr=a_ptr; label=ctx.label+3} in
   let ctx, tbody = compile' ctx id (Block (ty, texp)) in
   let ctx, fbody = compile' {ctx with ptr=a_ptr} id (Block (ty, fexp)) in
   ctx, [JUMPZ else_label] @ tbody @ [JUMP end_label; LABEL else_label] @ fbody @ [LABEL end_label]
 | Br x ->
   let num = Int32.to_int x.it in
   let c = List.nth ctx.block_return num in
   trace ("br " ^ string_of_int num ^ ": " ^ string_of_int c.rets ^ " return values, " ^ string_of_int c.level ^ " return pointer, " ^ string_of_int ctx.ptr ^ " current pointer");
   let adjust = adjust_stack (ctx.ptr - c.level) c.rets in
   {ctx with ptr=ctx.ptr - c.rets}, adjust @ [JUMP c.target]
 | BrIf x ->
   (* trace ("brif " ^ Int32.to_string x.it); *)
   let num = Int32.to_int x.it in
   let c = List.nth ctx.block_return num in
   let adjust = adjust_stack (ctx.ptr - c.level - 1) c.rets in
   let continue_label = ctx.label in
   let end_label = ctx.label+1 in
   {ctx with label=ctx.label+2; ptr = ctx.ptr-1},
   [JUMPI continue_label; JUMP end_label; LABEL continue_label] @ adjust @ [JUMP c.target; LABEL end_label]
 | BrTable (tab, def) ->
   let num = Int32.to_int def.it in
   let { rets; _ } = List.nth ctx.block_return num in
   (* Every level might need different adjustment, so generate the pieces here... at least the number returned values should be same *)
   let make_piece i idx =
     let num = Int32.to_int idx.it in
     let {level=ptr; target; _ } = List.nth ctx.block_return num in
     let adjust = adjust_stack (ctx.ptr - ptr - 1) rets in
     [LABEL (ctx.label+i)] @ adjust @ [JUMP target] in
   let jumps = List.mapi (fun i _ -> JUMP (ctx.label+i)) (tab@[def]) in
   let pieces = List.mapi make_piece (tab@[def]) in
   {ctx with ptr = ctx.ptr-1-rets; label=ctx.label + List.length tab + 2},
   [JUMPFORWARD (List.length tab)] @ jumps @ List.flatten pieces
 | Return ->
   let num = ctx.bptr-1 in
   let {level=ptr; rets; target } = List.nth ctx.block_return num in
   (* trace ("return: " ^ string_of_int rets ^ " return values, " ^ string_of_int ptr ^ " return pointer, " ^ string_of_int ctx.ptr ^ " current pointer"); *)
   let adjust = adjust_stack (ctx.ptr - ptr) rets in
   {ctx with ptr=ctx.ptr - rets}, adjust @ [JUMP target]
 | Drop ->
    (* trace "drop"; *)
    {ctx with ptr=ctx.ptr-1}, [DROP 1]
 | GrowMemory -> {ctx with ptr=ctx.ptr-1}, [GROW]
 | CurrentMemory -> {ctx with ptr=ctx.ptr+1}, [CURMEM]
 | GetGlobal x -> {ctx with ptr=ctx.ptr+1}, [LOADGLOBAL (Int32.to_int x.it)]
 | SetGlobal x ->
   (* trace "set global"; *)
   {ctx with ptr=ctx.ptr-1}, [STOREGLOBAL (Int32.to_int x.it)]
 | Call v ->
   (* Will just push the pc *)
   (* trace ("Function call " ^ Int32.to_string v.it); *)
   let FuncType (par,ret) = Hashtbl.find ctx.f_types v.it in
   let br = if ctx.add_points then [BREAKPOINT id] else [] in
   {ctx with ptr=ctx.ptr+List.length ret-List.length par}, br @ [CALL (Int32.to_int v.it, id)] @ br
 | CallIndirect v ->
   let FuncType (par,ret) = Hashtbl.find ctx.f_types2 v.it in
   (* trace ("call indirect type: " ^ Int64.to_string (Byteutil.ftype_hash (FuncType (par,ret)))); *)
   let br = if ctx.add_points then [BREAKPOINT id] else [] in
   {ctx with ptr=ctx.ptr+List.length ret-List.length par-1}, br @ [CHECKCALLI (Byteutil.ftype_hash (FuncType (par,ret))); CALLI id] @ br
 | Select ->
   (* trace "select"; *)
   let else_label = ctx.label in
   let end_label = ctx.label+1 in
   let ctx = {ctx with ptr=ctx.ptr-2; label=ctx.label+2} in
   ctx, [JUMPI else_label; SWAP 2; DROP 1; JUMP end_label; LABEL else_label; DROP 1; LABEL end_label]
 (* Dup ptr will give local 0 *)
 | GetLocal v ->
   (* trace ("get local " ^ string_of_int (Int32.to_int v.it) ^ " from " ^  string_of_int (ctx.ptr - Int32.to_int v.it)); *)
   {ctx with ptr=ctx.ptr+1}, [DUP (ctx.ptr - Int32.to_int v.it)]
 | SetLocal v ->
   (* trace "set local"; *)
   {ctx with ptr=ctx.ptr-1}, [SWAP (ctx.ptr - Int32.to_int v.it); DROP 1]
 | TeeLocal v ->
   ctx, [SWAP (ctx.ptr - Int32.to_int v.it)]
 | Load op -> ctx, [LOAD op]
 | Store op ->
   (* trace "store"; *)
   {ctx with ptr=ctx.ptr-2}, [STORE op]

and compile_block ctx = function
 | [] -> ctx, []
 | a::tl ->
    let ctx, a = compile ctx a in
    let ctx, rest = compile_block ctx tl in
    ctx, a @ rest

(* Initialize local variables with correct types *)

let find_export_name m num =
  let rec get_exports = function
   | [] -> "internal function"
   | {it=im; _} :: tl ->
     match im.edesc.it with
     | FuncExport {it=tvar; _} -> if Int32.to_int tvar = num then Utf8.encode im.name else get_exports tl
     | _ -> get_exports tl in
  get_exports m.exports

let debug_exports m =
  let rec get_exports = function
   | [] -> ()
   | {it=im; _} :: tl ->
     match im.edesc.it with
     | FuncExport {it=tvar; _} -> prerr_endline ("Export " ^ Int32.to_string tvar ^ " is " ^ Utf8.encode im.name) ; get_exports tl
     | _ -> get_exports tl in
  get_exports m.exports

let compile_func ctx idx func =
  let FuncType (par,ret) = Hashtbl.find ctx.f_types2 func.it.ftype.it in
  trace ("---- function start params:" ^ string_of_int (List.length par) ^ " locals: " ^ string_of_int (List.length func.it.locals) ^ " type: " ^ Int32.to_string func.it.ftype.it);
  trace ("Type hash: " ^ Int64.to_string (Byteutil.ftype_hash (FuncType (par,ret))));
  (* Just params are now in the stack *)
  let ctx, body = compile' {ctx with ptr=ctx.ptr+List.length par+List.length func.it.locals} 0l (Block (ret, func.it.body)) in
  trace ("---- function end " ^ string_of_int ctx.ptr);
  ctx,
  ( if false (* !Flags.trace *) then [STUB (find_export_name ctx.mdle idx ^ " Idx " ^ string_of_int idx ^ " Params " ^ String.concat "," (List.map type_to_str par) ^  " Return " ^ String.concat "," (List.map type_to_str ret))] else [] ) @
  List.map (fun x -> PUSH (default_value x)) func.it.locals @
  body @
  List.flatten (List.mapi (fun i _ -> [DUP (List.length ret - i); SWAP (ctx.ptr-i+1); DROP 1]) ret) @
  [DROP (List.length par + List.length func.it.locals); RETURN]

(* This resolves only one function *)
let resolve_inst tab = function
 | LABEL _ -> NOP
 | JUMP l ->
   let loc = Hashtbl.find tab l in
(*   trace ("resolve jump " ^ string_of_int l ^ " -> " ^ string_of_int loc); *)
   JUMP loc
 | JUMPI l ->
   let loc = Hashtbl.find tab l in
(*   trace ("resolve jumpi " ^ string_of_int l ^ " -> " ^ string_of_int loc); *)
   JUMPI loc
 | JUMPZ l -> JUMPZ (Hashtbl.find tab l)
 | a -> a

let resolve_to n lst =
  let tab = Hashtbl.create 10 in
  List.iteri (fun i inst -> match inst with LABEL l -> (* trace ("label " ^ string_of_int l); *) Hashtbl.add tab l (i+n)| _ -> ()) lst;
  List.map (resolve_inst tab) lst

let resolve_inst2 tab = function
 | CALL (l, id) -> CALL (Hashtbl.find tab l, id)
 | a -> a

let empty_ctx mdle = {ptr=0; label=0; bptr=0; block_return=[]; f_types2=Hashtbl.create 1; f_types=Hashtbl.create 1; mdle; add_points=false}

let malloc_string mdle malloc str =
  let open Memory in
  let open Types in
  let len = String.length str + 1 in
  let res = ref [] in
  for j = 0 to len-2 do
    res := [DUP 1; PUSH (i (Char.code str.[j])); STORE {ty=I32Type; align=0; offset=Int32.of_int (j + !Flags.memory_offset); sz=Some Mem8}] :: !res
  done;
  res := [DUP 1; PUSH (i 0); STORE {ty=I32Type; align=0; offset=Int32.of_int (len-1); sz=Some Mem8}] :: !res;
  (* array address is left *)
  [PUSH (i len); CALL (malloc, 0l)] @ List.flatten (List.rev (!res))

let make_args mdle inst lst =
  let malloc = find_function_index mdle inst (Utf8.decode "_malloc") in
  [PUSH (i (List.length lst)); (* argc *)
   PUSH (i (List.length lst * 4)); CALL (malloc, 0l)] @ (* argv *)
  List.flatten (List.mapi (fun i str -> [DUP 1] @ malloc_string mdle malloc str @ [STORE {ty=I32Type; align=0; offset=Int32.of_int (i*4 + !Flags.memory_offset); sz=None}]) lst)

let simple_call mdle inst name =
  try [STUB name; CALL (find_function_index mdle inst (Utf8.decode name), 0l)]
  with Not_found -> []

let init_fs_stack mdle inst =
(*  let stack_ptr = List.length (global_imports (elem mdle)) + 2 in
  prerr_endline ("Imported globals " ^ string_of_int (List.length (global_imports (elem mdle))));
  prerr_endline ("All globals " ^ string_of_int (List.length mdle.globals));
  let stack_max = List.length (global_imports (elem mdle)) + 3 in *)
  prerr_endline ("Warning: asm.js initialization is very dependant on the filesystem.wasm");
  let asmjs = find_global_index (elem mdle) (Utf8.decode "ASMJS") in
  (* let len = List.length (global_imports (elem mdle)) + List.length mdle.globals in
  let stack_ptr = len - 20 in *)
  let stack_ptr = asmjs - 16 in (* this is the difficult place *)
  let stack_max = stack_ptr + 1 in
  let malloc = find_function_index mdle inst (Utf8.decode "_malloc") in
  [PUSH (i 1024); CALL (malloc, 0l); DUP 1; DUP 1;
   STOREGLOBAL stack_ptr;
   BIN (I32 I32Op.Add);
   STOREGLOBAL stack_max]

let init_system mdle inst =
  (* This is the last point that we can use to initialize metering *)
  let num_globals = List.length (global_imports (elem mdle)) + List.length mdle.globals in
  ( try
      let initial_gas_limit = find_global_index (elem mdle) (Utf8.decode "GAS_LIMIT") in
      let gas_limit = num_globals in
      let gas = num_globals + 1 in
      [LOADGLOBAL initial_gas_limit; CONV (I64 I64Op.ExtendUI32); PUSH (I64 1000000L); BIN (I64 I64Op.Mul); STOREGLOBAL gas_limit; PUSH (I64 0L); STOREGLOBAL gas]
    with Not_found -> [] ) @
  simple_call mdle inst "__post_instantiate" @
  (if (try ignore (find_global_index (elem mdle) (Utf8.decode "ASMJS")); true with Not_found -> false) then init_fs_stack mdle inst else [] ) @
  simple_call mdle inst "_initSystem"

let find_initializers mdle =
  let rec do_find = function
   | exp :: lst ->
     let rest = do_find lst in
     let name = Utf8.encode exp.name in
     if String.length name > 15 && String.sub name 0 15 = "__GLOBAL__sub_I" then
       begin
         (* Run.trace ("initializer " ^ name); *)
         name :: rest
       end else
     if String.length name >= 22 && String.sub name 0 22 = "___cxx_global_var_init" then
       begin
         (* Run.trace ("initializer " ^ name); *)
         name :: rest
       end else
     rest
   | [] -> [] in
  do_find (List.map (fun x -> x.it) mdle.exports)

let make_cxx_init mdle inst =
  simple_call mdle inst "__GLOBAL__I_000101" @
  List.flatten (List.map (fun name -> simple_call mdle inst name) (List.rev (find_initializers mdle)))
  (* @
  [STUB "Initialization finished"] *)

let generic_stub m inst mname fname =
    try [STUB (mname ^ " . " ^ fname); CALL (find_function_index m inst (Utf8.decode "_finalizeSystem"), 0l); EXIT]
    with Not_found -> [STUB (mname ^ " . " ^ fname); EXIT]

(*
let generic_stub m inst mname fname =
  try
  [STUB (mname ^ " . " ^ fname);
   CALL (find_function_index m inst (Utf8.decode "_callArguments"), 0l);
   DROP_N;
   CALL (find_function_index m inst (Utf8.decode "_callMemory"), 0l);
   (* Just handle zero or one return values *)
   CALL (find_function_index m inst (Utf8.decode "_callReturns"), 0l);
   JUMPI (-2);
   JUMP (-3);
   LABEL (-2);
   CALL (find_function_index m inst (Utf8.decode "_getReturn"), 0l); (* here we should do a type adjustment???? *)
   LABEL (-3);
   RETURN]
  with Not_found -> [STUB (mname ^ " . " ^ fname); RETURN]
*)

let mem_init_size m =
  if !Flags.run_wasm || !Flags.disable_float then Byteutil.pow2 (!Flags.memory_size - 13) else
  let open Ast in
  let open Types in
  let open Source in
  let res = ref 0 in
  List.iter (function MemoryType {min; _} ->
    trace ("Memory size " ^ Int32.to_string min);
    res := Int32.to_int min) (List.map (fun a -> a.it.mtype) m.memories);
  !res

let vm_init m =
  [ PUSH (i (mem_init_size m)); GROW;
    SETSTACK !Flags.stack_size;
    SETMEMORY !Flags.memory_size;
    SETCALLSTACK !Flags.call_size;
    SETGLOBALS !Flags.globals_size;
    SETTABLE !Flags.table_size ]

let flatten_tl lst =
  let rec do_flatten acc = function
  | [] -> acc
  | a::tl -> do_flatten (a @ acc) tl in
  do_flatten [] (List.rev lst)

let generate_entry id_to_local (lst, others) =
   let stack_size = List.length lst + others in
   (* others will have to be moved to make space *)
   let n = List.length lst in
   gen n (fun i -> DUP 1) @ (* fillers *)
   gen others (fun i -> DUP (others-i+n+1)) @ (* this should copy the others *)
   List.flatten (List.mapi (fun i id -> [DUP (stack_size + List.assoc id_to_local id); SWAP (stack_size-i); DROP 1]) lst) (* access local variable, then write to filled location *)

let generate_exit id_to_local (lst, others) =
   (* let stack_size = List.length lst + others in *)
   (* others will have to be moved over the hidden variables *)
   let n = List.length lst in
   List.flatten (gen others (fun i -> [DUP (others-i+1); SWAP (others-i+1+n); DROP 1])) @ (* this should copy the others *)
   [DROP others]

let compile_test m func vs init inst =
  (* debug_exports m; *)
  (try
      let g_ind = find_global_index (elem m) (Utf8.decode "MEMORY_OFFSET") in
      let g = List.nth m.globals g_ind in
      Flags.memory_offset := value_to_int (Eval.eval_const inst g.it.value)
   with Not_found -> () );
  trace ("Function types: " ^ string_of_int (List.length m.types));
  trace ("Functions: " ^ string_of_int (List.length m.funcs));
  trace ("Tables: " ^ string_of_int (List.length m.tables));
  trace ("Data: " ^ string_of_int (List.length m.data));
  trace ("Elem: " ^ string_of_int (List.length m.elems));
  if List.length (List.flatten (List.map (fun dta -> dta.it.init) m.elems)) > Byteutil.pow2 !Flags.table_size then prerr_endline "Warning: too large call table!";
  if List.length m.globals + 10 > Byteutil.pow2 !Flags.globals_size then prerr_endline "Warning: too many globals!";
  let ftab = Hashtbl.create 10 in
  let ttab = Hashtbl.create 10 in
  List.iteri (fun i f -> Hashtbl.add ttab (Int32.of_int i) f.it) m.types;
  let entry = ref 0 in
  (* handle imports first *)
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
  trace ("Found " ^ string_of_int num_imports ^ " imported functions");
  List.iteri (fun i f ->
    if f = func then ( trace "found invoked function" ; entry := i + num_imports );
    let ty = Hashtbl.find ttab f.it.ftype.it in
    Hashtbl.add ftab (Int32.of_int (i + num_imports)) ty) m.funcs;
  (* perhaps could do something with the function type *)
  (* one idea would be to use a debugging message *)
  let exit_code =
    try [CALL (find_function_index m inst (Utf8.decode "_finalizeSystem"), 0l); EXIT]
    with Not_found -> [EXIT] in
  let import_codes = List.map (fun im ->
     let mname = Utf8.encode im.module_name in
     let fname = Utf8.encode im.item_name in
     trace ("importing " ^ fname ^ " from " ^ mname);
     if mname = "env" && fname = "_inputName" then [INPUTNAME;RETURN] else
     if mname = "env" && fname = "_inputSize" then [INPUTSIZE;RETURN] else
     if mname = "env" && fname = "_inputData" then [INPUTDATA;RETURN] else
     if mname = "env" && fname = "_outputName" then [OUTPUTNAME;RETURN] else
     if mname = "env" && fname = "_outputSize" then [OUTPUTSIZE;RETURN] else
     if mname = "env" && fname = "_outputData" then [OUTPUTDATA;RETURN] else
     if mname = "env" && fname = "_sbrk" then
       [STUB "sbrk";
        LOADGLOBAL (find_global_index (elem m) (Utf8.decode "DYNAMICTOP_PTR"));
        LOAD {ty=I32Type; align=0; offset=Int32.of_int !Flags.memory_offset; sz=None};
        DUP 1;
        DUP 3;
        BIN (I32 I32Op.Add);
        LOADGLOBAL (find_global_index (elem m) (Utf8.decode "DYNAMICTOP_PTR"));
        DUP 2;
        STORE {ty=I32Type; align=0; offset=Int32.of_int !Flags.memory_offset; sz=None};
        DUP 2;
        SWAP 4;
        DROP 3;
        RETURN]
       else
     (* invoke index, a1, a2*)
     if mname = "env" && String.length fname > 7 && String.sub fname 0 7 = "invoke_" then
       let number = String.sub fname 7 (String.length fname - 7) in
       [CALL (find_function_index m inst (Utf8.decode ("dynCall_" ^ number)), 0l); RETURN] else
     if mname = "env" && String.length fname > 8 && String.sub fname 0 8 = "_invoke_" then
       let number = String.sub fname 8 (String.length fname - 8) in
       try [ (* STUB fname; *) CALL (find_function_index m inst (Utf8.decode ("_dynCall_" ^ number)), 0l); RETURN]
       with Not_found ->
         prerr_endline ("Warning: cannot find dynamic call number " ^ number);
         [RETURN] else
     if mname = "env" && fname = "abort" then [UNREACHABLE] else
     if mname = "env" && fname = "_exit" then exit_code else
     if mname = "env" && fname = "getTotalMemory" then
        try [LOADGLOBAL (find_global_index (elem m) (Utf8.decode "TOTAL_MEMORY")); RETURN]
        with Not_found ->
        ( prerr_endline "Warning, cannot find global variable TOTAL_MEMORY. Use emscripten-module-wrapper to run files that were generated by emscripten";
          [PUSH (i (1024*1024*1500)); RETURN] ) else
     if mname = "env" && fname = "setTempRet0" then
        try [STUB "setTempRet0 (found)"; CALL (find_function_index m inst (Utf8.decode ("setTempRet0")), 0l); RETURN]
        with Not_found -> [STUB "setTempRet0"; DROP 1; RETURN] else
(*     if mname = "env" && fname = "_rintf" then [UNA (F32 F32Op.Nearest); RETURN] else *)
     if mname = "env" && fname = "_rintf" then [STUB "rintf"; RETURN] else
     if mname = "env" && fname = "_sqrt" then [STUB "sqrt"; UNA (F64 F64Op.Sqrt); RETURN] else
     if mname = "env" && fname = "_fabsf" then [STUB "fabsf"; UNA (F32 F32Op.Abs); RETURN] else
     if mname = "env" && fname = "_cosf" then [STUB "cosf"; RETURN] else
     if mname = "env" && fname = "_sinf" then [STUB "sinf"; RETURN] else
     if mname = "env" && fname = "pushFrame" then
         let stack_limit = Int32.of_int (Byteutil.pow2 !Flags.stack_size - Stacksize.check (elem m)) in
         let call_limit = Int32.of_int (Byteutil.pow2 !Flags.call_size - 1) in
         let num_globals = List.length (global_imports (elem m)) + List.length m.globals in
         let call_stack = num_globals + 2 in
         let frame_stack = num_globals + 3 in
         [LOADGLOBAL frame_stack; BIN (I32 I32Op.Add); STOREGLOBAL frame_stack;
          PUSH (I32 1l); LOADGLOBAL call_stack; BIN (I32 I32Op.Add); STOREGLOBAL call_stack;
          LOADGLOBAL frame_stack; PUSH (I32 stack_limit); CMP (I32 I32Op.GtU); JUMPI (-11);
          LOADGLOBAL call_stack; PUSH (I32 call_limit); CMP (I32 I32Op.GtU); JUMPI (-11);
          RETURN; LABEL (-11); UNREACHABLE] else
     if mname = "env" && fname = "popFrame" then
         let num_globals = List.length (global_imports (elem m)) + List.length m.globals in
         let call_stack = num_globals + 2 in
         let frame_stack = num_globals + 3 in
         [LOADGLOBAL frame_stack; BIN (I32 I32Op.Sub); STOREGLOBAL frame_stack;
          PUSH (I32 0l); LOADGLOBAL frame_stack; BIN (I32 I32Op.Sub); STOREGLOBAL frame_stack;
          LOADGLOBAL call_stack; PUSH (I32 1l); BIN (I32 I32Op.Sub); STOREGLOBAL call_stack;
          RETURN; LABEL (-11); UNREACHABLE] else
     if mname = "env" && fname = "usegas" || mname = "env" && fname = "gas" then
       try
         let _ (* initial gas limit *) = find_global_index (elem m) (Utf8.decode "GAS_LIMIT") in
         let num_globals = List.length (global_imports (elem m)) + List.length m.globals in
         let gas_limit = num_globals in
         let gas = num_globals + 1 in
         [CONV (I64 I64Op.ExtendUI32); LOADGLOBAL gas; BIN (I64 I64Op.Add); STOREGLOBAL gas; LOADGLOBAL gas; (* STUB "env . _debugInt"; *) LOADGLOBAL gas_limit; CMP (I64 I64Op.GtU); JUMPI (-10); RETURN; LABEL (-10); UNREACHABLE]
       with Not_found -> [ STUB "env . _debugInt"; DROP 1; RETURN] else
     if mname = "env" && fname = "_debugString" then [STUB (mname ^ " . " ^ fname); RETURN] else
     if mname = "env" && fname = "_debugBuffer" then [STUB (mname ^ " . " ^ fname); DROP 1; RETURN] else
     if mname = "env" && fname = "_debugInt" then [STUB (mname ^ " . " ^ fname); RETURN] else
     if mname = "env" && fname = "_getSystem" then [LOADGLOBAL (find_global_index (elem m) (Utf8.decode "_system_ptr")); RETURN] else
     if mname = "env" && fname = "_setSystem" then [STOREGLOBAL (find_global_index (elem m) (Utf8.decode "_system_ptr")); RETURN] else
     if mname = "env" && Hashtbl.mem custom_calls fname then [CUSTOM (Hashtbl.find custom_calls fname); RETURN] else
     generic_stub m inst mname fname ) f_imports in
  let module_codes = List.mapi (fun i f ->
     if f = func then trace "*************** CURRENT ";
     compile_func {(empty_ctx m) with f_types2=ttab; f_types=ftab; add_points = !Flags.br_mode} (i + List.length f_imports) f) m.funcs in
  let f_resolve = Hashtbl.create 10 in
  let rec build n acc l_acc = function
   | [] -> acc
   | fcode::tl ->
     Hashtbl.add f_resolve n l_acc;
     trace ("Function " ^ string_of_int n ^ " at " ^ string_of_int l_acc);
     let x = resolve_to l_acc fcode in
     build (n+1) (x::acc) (List.length x + l_acc) tl in
  let test_code = init @ List.map (fun v -> PUSH v) vs @ [CALL (!entry, 0l)] @ exit_code in
  let codes = build 0 [test_code] (List.length test_code) (import_codes @ List.map snd module_codes) in
  trace ("Here, working");
  let flat_code = flatten_tl (List.rev codes) in
  trace ("flatten ???");
  List.rev (List.rev_map (resolve_inst2 f_resolve) flat_code), f_resolve

