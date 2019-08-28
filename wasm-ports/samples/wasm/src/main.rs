extern crate parity_wasm;

use parity_wasm::{elements, builder};

fn main() {
    let inc : u32 = 10240;
    let mut module = parity_wasm::deserialize_file("input.wasm").unwrap();
    assert!(module.code_section().is_some());
    {
        let code_section = module.code_section().unwrap(); // Part of the module with functions code

        let data_section = module.data_section().unwrap();

        println!("Function count in wasm file: {}", code_section.bodies().len());
        println!("Segment count in wasm file: {}", data_section.entries().len());
    }

    parity_wasm::serialize_to_file("output.wasm", module).expect("Module serialization to succeed");
}

