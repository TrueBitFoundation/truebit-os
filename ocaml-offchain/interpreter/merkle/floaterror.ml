

open Source
open Ast
open Values
open Sourceutil

let process m =
  let rec convert_op' = function
   | Block (ty, lst) -> [Block (ty, convert_body lst)]
   | Loop (ty, lst) -> [Loop (ty, convert_body lst)]
   | If (ty, texp, fexp) -> [If (ty, convert_body texp, convert_body fexp)]

(*
   | Store ({ty=F32Type; _} as op) -> [Store {op with ty=I32Type}]
   | Load ({ty=F32Type; _} as op) -> [Load {op with ty=I32Type}]
   | Store ({ty=F64Type; _} as op) -> [Store {op with ty=I64Type}]
   | Load ({ty=F64Type; _} as op) -> [Load {op with ty=I64Type}]
   | Const {it=F32 f; _} -> [Const (elem (I32 (F32.to_bits f)))]
   | Const {it=F64 f; _} -> [Const (elem (I64 (F64.to_bits f)))]
*)

   | Binary (F32 _)
   | Unary (F32 _)
   | Compare (F32 _) 
   | Convert (F32 _)
   | Binary (F64 _)
   | Unary (F64 _)
   | Compare (F64 _) 
   | Convert (F64 _)
   | Convert (I32 I32Op.ReinterpretFloat)
   | Convert (I64 I64Op.ReinterpretFloat)
   | Convert (I32 I32Op.TruncSF32)
   | Convert (I32 I32Op.TruncUF32)
   | Convert (I32 I32Op.TruncSF64)
   | Convert (I32 I32Op.TruncUF64)
   | Convert (I64 I64Op.TruncSF32)
   | Convert (I64 I64Op.TruncUF32)
   | Convert (I64 I64Op.TruncSF64)
   | Convert (I64 I64Op.TruncUF64) -> [Unreachable]
   
   | a -> [a]
  and convert_op x = List.map elem (convert_op' x.it)
  and convert_body lst = List.flatten (List.map convert_op lst) in
  let convert_func f = do_it f (fun f -> {f with body=convert_body f.body}) in
  let convert_global g = do_it g (fun g -> {g with value=do_it g.value convert_body}) in
  Run.trace "Converting floats to errors";
  do_it m (fun m -> {m with funcs=List.map convert_func m.funcs; globals=List.map convert_global m.globals})



