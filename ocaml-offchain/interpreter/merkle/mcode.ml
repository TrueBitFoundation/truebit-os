
open Types
open Values
open Mrun
open Ast 

(* Loading microcode *)

let get_type_code = function
 | 0 -> I32Type
 | 1 -> I64Type
 | 2 -> F32Type
 | 3 -> F64Type
 | a -> prerr_endline (string_of_int a); assert false

let get_sz_code = function
 | 1 -> Memory.Mem8
 | 2 -> Memory.Mem16
 | 4 -> Memory.Mem32
 | _ -> assert false

let get_ext_code = function
 | 0 -> Memory.ZX
 | 1 -> Memory.SX
 | _ -> assert false

let get_size_code = function
 | 0 -> None
 | a -> Some (get_sz_code (a lsr 1), get_ext_code (a land 0x01))

let get_alu_byte = function
 | 0x00 -> Mrun.Nop
 | 0x01 -> Trap
 | 0x02 -> Min
 | 0x03 -> CheckJump
 | 0x08 -> CheckJumpZ
 | 0x04 -> CheckJumpForward
 | 0x06 -> Exit
 | 0x07 -> CheckDynamicCall
 | 0x09 -> DebugInt
 | 0x0a -> DebugString
 | 0x0b -> DebugBuffer
 
 | 0x45 -> Test (I32 I32Op.Eqz)
 | 0x46 -> Compare (I32 I32Op.Eq)
 | 0x47 -> Compare (I32 I32Op.Ne)
 | 0x48 -> Compare (I32 I32Op.LtS)
 | 0x49 -> Compare (I32 I32Op.LtU)
 | 0x4a -> Compare (I32 I32Op.GtS)
 | 0x4b -> Compare (I32 I32Op.GtU)
 | 0x4c -> Compare (I32 I32Op.LeS)
 | 0x4d -> Compare (I32 I32Op.LeU)
 | 0x4e -> Compare (I32 I32Op.GeS)
 | 0x4f -> Compare (I32 I32Op.GeU)
 | 0x50 -> Test (I64 I64Op.Eqz)
 | 0x51 -> Compare (I64 I64Op.Eq)
 | 0x52 -> Compare (I64 I64Op.Ne)
 | 0x53 -> Compare (I64 I64Op.LtS)
 | 0x54 -> Compare (I64 I64Op.LtU)
 | 0x55 -> Compare (I64 I64Op.GtS)
 | 0x56 -> Compare (I64 I64Op.GtU)
 | 0x57 -> Compare (I64 I64Op.LeS)
 | 0x58 -> Compare (I64 I64Op.LeU)
 | 0x59 -> Compare (I64 I64Op.GeS)
 | 0x5a -> Compare (I64 I64Op.GeU)
 | 0x5b -> Compare (F32 F32Op.Eq)
 | 0x5c -> Compare (F32 F32Op.Ne)
 | 0x5d -> Compare (F32 F32Op.Lt)
 | 0x5e -> Compare (F32 F32Op.Gt)
 | 0x5f -> Compare (F32 F32Op.Le)
 | 0x60 -> Compare (F32 F32Op.Ge)
 | 0x61 -> Compare (F64 F64Op.Eq)
 | 0x62 -> Compare (F64 F64Op.Ne)
 | 0x63 -> Compare (F64 F64Op.Lt)
 | 0x64 -> Compare (F64 F64Op.Gt)
 | 0x65 -> Compare (F64 F64Op.Le)
 | 0x66 -> Compare (F64 F64Op.Ge)
 | 0x67 -> Unary (I32 I32Op.Clz)
 | 0x68 -> Unary (I32 I32Op.Ctz)
 | 0x69 -> Unary (I32 I32Op.Popcnt)
 | 0x6a -> Binary (I32 I32Op.Add)
 | 0x6b -> Binary (I32 I32Op.Sub)
 | 0x6c -> Binary (I32 I32Op.Mul)
 | 0x6d -> Binary (I32 I32Op.DivS)
 | 0x6e -> Binary (I32 I32Op.DivU)
 | 0x6f -> Binary (I32 I32Op.RemS)
 | 0x70 -> Binary (I32 I32Op.RemU)
 | 0x71 -> Binary (I32 I32Op.And)
 | 0x72 -> Binary (I32 I32Op.Or)
 | 0x73 -> Binary (I32 I32Op.Xor)
 | 0x74 -> Binary (I32 I32Op.Shl)
 | 0x75 -> Binary (I32 I32Op.ShrS)
 | 0x76 -> Binary (I32 I32Op.ShrU)
 | 0x77 -> Binary (I32 I32Op.Rotl)
 | 0x78 -> Binary (I32 I32Op.Rotr)
 | 0x79 -> Unary (I64 I64Op.Clz)
 | 0x7a -> Unary (I64 I64Op.Ctz)
 | 0x7b -> Unary (I64 I64Op.Popcnt)
 | 0x7c -> Binary (I64 I64Op.Add)
 | 0x7d -> Binary (I64 I64Op.Sub)
 | 0x7e -> Binary (I64 I64Op.Mul)
 | 0x7f -> Binary (I64 I64Op.DivS)
 | 0x80 -> Binary (I64 I64Op.DivU)
 | 0x81 -> Binary (I64 I64Op.RemS)
 | 0x82 -> Binary (I64 I64Op.RemU)
 | 0x83 -> Binary (I64 I64Op.And)
 | 0x84 -> Binary (I64 I64Op.Or)
 | 0x85 -> Binary (I64 I64Op.Xor)
 | 0x86 -> Binary (I64 I64Op.Shl)
 | 0x87 -> Binary (I64 I64Op.ShrS)
 | 0x88 -> Binary (I64 I64Op.ShrU)
 | 0x89 -> Binary (I64 I64Op.Rotl)
 | 0x8a -> Binary (I64 I64Op.Rotr)
 | 0x8b -> Unary (F32 F32Op.Abs)
 | 0x8c -> Unary (F32 F32Op.Neg)
 | 0x8d -> Unary (F32 F32Op.Ceil)
 | 0x8e -> Unary (F32 F32Op.Floor)
 | 0x8f -> Unary (F32 F32Op.Trunc)
 | 0x90 -> Unary (F32 F32Op.Nearest)
 | 0x91 -> Unary (F32 F32Op.Sqrt)
 | 0x92 -> Binary (F32 F32Op.Add)
 | 0x93 -> Binary (F32 F32Op.Sub)
 | 0x94 -> Binary (F32 F32Op.Mul)
 | 0x95 -> Binary (F32 F32Op.Div)
 | 0x96 -> Binary (F32 F32Op.Min)
 | 0x97 -> Binary (F32 F32Op.Max)
 | 0x98 -> Binary (F32 F32Op.CopySign)
 | 0x99 -> Unary (F64 F64Op.Abs)
 | 0x9a -> Unary (F64 F64Op.Neg)
 | 0x9b -> Unary (F64 F64Op.Ceil)
 | 0x9c -> Unary (F64 F64Op.Floor)
 | 0x9d -> Unary (F64 F64Op.Trunc)
 | 0x9e -> Unary (F64 F64Op.Nearest)
 | 0x9f -> Unary (F64 F64Op.Sqrt)
 | 0xa0 -> Binary (F64 F64Op.Add)
 | 0xa1 -> Binary (F64 F64Op.Sub)
 | 0xa2 -> Binary (F64 F64Op.Mul)
 | 0xa3 -> Binary (F64 F64Op.Div)
 | 0xa4 -> Binary (F64 F64Op.Min)
 | 0xa5 -> Binary (F64 F64Op.Max)
 | 0xa6 -> Binary (F64 F64Op.CopySign)
 | 0xa7 -> Convert (I32 I32Op.WrapI64)
 | 0xa8 -> Convert (I32 I32Op.TruncSF32)
 | 0xa9 -> Convert (I32 I32Op.TruncUF32)
 | 0xaa -> Convert (I32 I32Op.TruncSF64)
 | 0xab -> Convert (I32 I32Op.TruncUF64)
 | 0xac -> Convert (I64 I64Op.ExtendSI32)
 | 0xad -> Convert (I64 I64Op.ExtendUI32)
 | 0xae -> Convert (I64 I64Op.TruncSF32)
 | 0xaf -> Convert (I64 I64Op.TruncUF32)
 | 0xb0 -> Convert (I64 I64Op.TruncSF64)
 | 0xb1 -> Convert (I64 I64Op.TruncUF64)
 | 0xb2 -> Convert (F32 F32Op.ConvertSI32)
 | 0xb3 -> Convert (F32 F32Op.ConvertUI32)
 | 0xb4 -> Convert (F32 F32Op.ConvertSI64)
 | 0xb5 -> Convert (F32 F32Op.ConvertUI64)
 | 0xb6 -> Convert (F32 F32Op.DemoteF64)
 | 0xb7 -> Convert (F64 F64Op.ConvertSI32)
 | 0xb8 -> Convert (F64 F64Op.ConvertUI32)
 | 0xb9 -> Convert (F64 F64Op.ConvertSI64)
 | 0xba -> Convert (F64 F64Op.ConvertUI64)
 | 0xbb -> Convert (F64 F64Op.PromoteF32)
 | 0xbc -> Convert (I32 I32Op.ReinterpretFloat)
 | 0xbd -> Convert (I64 I64Op.ReinterpretFloat)
 | 0xbe -> Convert (F32 F32Op.ReinterpretInt)
 | 0xbf -> Convert (F64 F64Op.ReinterpretInt)
 | a ->
    if 0xc0 land a = 0xc0 then FixMemory (get_type_code ((a lsr 4) land 0x3), get_size_code (a land 0x0f))
    else assert false

let get_in_code_byte = function
 | 0x00 -> NoIn
 | 0x01 -> Immed
 | 0x02 -> ReadPc
 | 0x03 -> ReadStackPtr
 | 0x04 -> MemsizeIn
 | 0x05 -> GlobalIn
 | 0x06-> StackIn0
 | 0x07 -> StackIn1
 | 0x08 -> StackInReg
 | 0x09 -> StackInReg2
 | 0x0e -> CallIn
 | 0x0f -> MemoryIn1
 | 0x10 -> TableIn
 | 0x11 -> MemoryIn2
 | 0x12 -> TableTypeIn
 | 0x13 -> InputSizeIn
 | 0x14 -> InputNameIn
 | 0x15 -> InputDataIn
 | 0x16 -> StackIn2
 | _ -> assert false

let get_reg_byte = function
 | 0x01 -> Reg1
 | 0x02 -> Reg2
 | 0x03 -> Reg3
 | _ -> assert false

let get_out_sz_code = function
 | 0 -> None
 | 1 -> Some Memory.Mem8
 | 2 -> Some Memory.Mem16
 | 4 -> Some Memory.Mem32
 | _ -> assert false

let get_out_code_byte = function
 | 0x00 -> NoOut
 | 0x02 -> StackOutReg1
 | 0x03 -> StackOut0
 | 0x04 -> StackOut1
 | 0x06 -> CallOut
 | 0x08 -> GlobalOut
 | 0x09 -> StackOut2
 | 0x0a -> InputSizeOut
 | 0x0b -> InputNameOut
 | 0x0c -> InputCreateOut
 | 0x0d -> InputDataOut
 | 0x0e -> CallTableOut
 | 0x0f -> CallTypeOut
 | 0x10 -> SetStack
 | 0x11 -> SetCallStack
 | 0x12 -> SetGlobals
 | 0x13 -> SetTable
 | 0x14 -> SetTableTypes
 | 0x15 -> SetMemory
 | 0x16 -> CustomFileWrite

 | a ->
    if 0xc0 land a = 0x80 then MemoryOut1 (get_type_code ((a lsr 3) land 0x03), get_out_sz_code (a land 0x03))
    else if 0xc0 land a = 0xc0 then MemoryOut2 (get_type_code ((a lsr 3) land 0x03), get_out_sz_code (a land 0x03))
    else ( prerr_endline (string_of_int a) ; assert false )

let get_stack_ch_byte = function
 | 0x00 -> StackRegSub
 | 0x01 -> StackReg
 | 0x02 -> StackReg2
 | 0x03 -> StackReg3
 | 0x04 -> StackInc
 | 0x05 -> StackDec
 | 0x06 -> StackNop
 | 0x07 -> StackDec2
 | 0x08 -> StackDecImmed
 | _ -> assert false

let get_code (w:string) =
  let b n =
     let res = Char.code w.[n] in
     res in
  let imm = ref 0L in
  for i = 0 to 7 do
     let v = Int64.of_int (b (11+i)) in
     imm := Int64.add v (Int64.mul 256L !imm)
  done;
  {
  read_reg1=get_in_code_byte (b 31);
  read_reg2=get_in_code_byte (b 30);
  read_reg3=get_in_code_byte (b 29);
  alu_code=get_alu_byte (b 28);
  write1=(get_reg_byte (b 27), get_out_code_byte (b 26));
  write2=(get_reg_byte (b 25), get_out_code_byte (b 24));
  call_ch=get_stack_ch_byte (b 23);
  stack_ch=get_stack_ch_byte (b 22);
  pc_ch=get_stack_ch_byte (b 20);
  mem_ch=if b 19 = 0 then false else true;
  immed=I64 !imm;
  }

let load_microcode (fname:string) : microp array =
  (* read file *)
  let ch = open_in_bin fname in
  let sz = in_channel_length ch in
  let dta = Bytes.create sz in
  really_input ch dta 0 sz;
  (* split to pieces *)
  let asz = sz/32 in
  let acc = Array.make asz noop in
  for i = 0 to asz - 1 do
     try
       acc.(i) <- get_code (Bytes.sub_string dta (i*32) 32)
     with e -> prerr_endline ("Error at word " ^ string_of_int i); raise e
  done;
  acc


