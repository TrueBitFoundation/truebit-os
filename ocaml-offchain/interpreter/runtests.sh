#!/bin/sh

process() {
   # echo $1
   ./wasm -m $1
}

process ../test/core/address.wast || exit 1
process ../test/core/align.wast || exit 1
process ../test/core/binary.wast || exit 1
process ../test/core/block.wast || exit 1
process ../test/core/break-drop.wast || exit 1
process ../test/core/br_if.wast || exit 1
process ../test/core/br_table.wast || exit 1
process ../test/core/br.wast || exit 1
process ../test/core/call_indirect.wast || exit 1
process ../test/core/call.wast || exit 1
process ../test/core/comments.wast || exit 1
process  ../test/core/const.wast || exit 1
process  ../test/core/conversions.wast || exit 1
process ../test/core/custom_section.wast || exit 1
# ./wasm -m ../test/core/elem.wast || exit 1
process ../test/core/endianness.wast || exit 1
process ../test/core/exports.wast || exit 1
process  ../test/core/f32_bitwise.wast || exit 1
process  ../test/core/f32_cmp.wast || exit 1
process  ../test/core/f32.wast || exit 1
process  ../test/core/f64_bitwise.wast || exit 1
process  ../test/core/f64_cmp.wast || exit 1
process  ../test/core/f64.wast || exit 1
process  ../test/core/fac.wast || exit 1
#./wasm -m ../test/core/float_exprs.wast || exit 1
#./wasm -m ../test/core/float_literals.wast || exit 1
#./wasm -m ../test/core/float_memory.wast || exit 1
process  ../test/core/float_misc.wast || exit 1
process  ../test/core/forward.wast || exit 1
process  ../test/core/func_ptrs.wast || exit 1
process ../test/core/func.wast || exit 1
process ../test/core/get_local.wast || exit 1
#./wasm -m ../test/core/globals.wast || exit 1
process ../test/core/i32.wast || exit 1
process ../test/core/i64.wast || exit 1
./wasm -m ../test/core/if.wast || exit 1
#./wasm -m ../test/core/imports.wast || exit 1
process ../test/core/inline-module.wast || exit 1
process ../test/core/int_exprs.wast || exit 1
process ../test/core/int_literals.wast || exit 1
process  ../test/core/labels.wast || exit 1
process ../test/core/left-to-right.wast || exit 1
#./wasm -m ../test/core/linking.wast || exit 1
process ../test/core/loop.wast || exit 1
process  ../test/core/memory_redundancy.wast || exit 1
#./wasm -m ../test/core/memory_trap.wast || exit 1
process ../test/core/memory.wast || exit 1
#./wasm -m ../test/core/names.wast || exit 1
#./wasm -m ../test/core/nop.wast || exit 1
#./wasm -m ../test/core/resizing.wast || exit 1
process  ../test/core/return.wast || exit 1
process ../test/core/select.wast || exit 1
process ../test/core/set_local.wast || exit 1
process ../test/core/skip-stack-guard-page.wast || exit 1
process ../test/core/stack.wast || exit 1
#./wasm -m ../test/core/start.wast || exit 1
process  ../test/core/store_retval.wast || exit 1
process ../test/core/switch.wast || exit 1
process  ../test/core/tee_local.wast || exit 1
process  ../test/core/token.wast || exit 1
process  ../test/core/traps.wast || exit 1
process  ../test/core/typecheck.wast || exit 1
process  ../test/core/type.wast || exit 1
process  ../test/core/unreachable.wast || exit 1
process  ../test/core/unreached-invalid.wast || exit 1
process  ../test/core/unwind.wast || exit 1
process  ../test/core/utf8-custom-section-id.wast || exit 1
process  ../test/core/utf8-import-field.wast || exit 1
process  ../test/core/utf8-import-module.wast || exit 1
