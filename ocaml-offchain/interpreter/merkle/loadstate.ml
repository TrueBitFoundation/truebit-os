
(* Loading an intermediate state and running from there *)

open Source
open Sourceutil

let load_file vm =
  let open Yojson.Basic in
  let open Mrun in
  let data = from_channel (open_in "state.json") in
  vm.pc <- Util.to_int (Util.member "pc" data) + 1;
  let call_lst = List.map Util.to_int (Util.to_list (Util.member "call_stack" data)) in
  let stack_lst = List.map Util.to_int (Util.to_list (Util.member "stack" data)) in
  vm.stack <- Array.make (Byteutil.pow2 !Flags.stack_size) (i 0);
  vm.call_stack <- Array.make (Byteutil.pow2 !Flags.call_size) 0;
  vm.stack_ptr <- List.length stack_lst;
  vm.call_ptr <- List.length call_lst;
  List.iteri (fun j elem -> vm.call_stack.(j) <- elem) call_lst;
  List.iteri (fun j elem -> vm.stack.(j) <- Values.I64 (Int64.of_int elem)) stack_lst

let run mdle =
  Flags.br_mode := true;
  let imports = Import.link mdle in
  let inst = Eval.init mdle imports in
  let func = match Instance.export inst (Utf8.decode "_main") with
      | Some (Instance.ExternalFunc (Instance.AstFunc (_, func))) -> func
      | _ -> raise (Failure "no main function") in
  let vm = Run.setup_vm inst mdle.it func [] in
  load_file vm;
  (* here we should load *)
  ignore (Run.run_test_aux vm)

