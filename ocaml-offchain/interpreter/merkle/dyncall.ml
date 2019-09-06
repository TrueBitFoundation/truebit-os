
open Ast
open Source
open Sourceutil

(* Handling dynamic calls *)
let process m =
  let imports = Import.link m in
  let inst = Eval.init m imports in
  let tab = Hashtbl.create 10 in
  let handle_import num im =
     let mname = Utf8.encode im.it.module_name in
     let fname = Utf8.encode im.it.item_name in
     if mname = "env" && String.length fname > 8 && String.sub fname 0 8 = "_invoke_" then begin
       let number = String.sub fname 8 (String.length fname - 8) in
       try
         let idx = find_function_index m.it inst (Utf8.decode ("_dynCall_" ^ number)) in
         Hashtbl.add tab (Int32.of_int num) (Int32.of_int idx)
       with Not_found -> prerr_endline ("Warning: cannot find dynamic call with signature " ^ number)
     end in
  List.iteri handle_import (Sourceutil.func_imports m);
  let fmap x = try Hashtbl.find tab x with Not_found -> x in
  do_it m (fun m ->
     {m with funcs = List.map (Merge.remap fmap (fun x -> x) (fun x -> x)) m.funcs;
        elems = List.map (Merge.remap_elements fmap) m.elems;}
  )

