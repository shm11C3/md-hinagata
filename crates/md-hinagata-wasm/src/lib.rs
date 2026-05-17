use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen(js_name = coreVersion)]
pub fn core_version() -> String {
    md_hinagata_core::version().to_owned()
}

#[wasm_bindgen(js_name = transformMarkdownJson)]
pub fn transform_markdown_json(input: JsValue) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();

    let request = serde_wasm_bindgen::from_value(input).map_err(to_js_error)?;
    let response = md_hinagata_core::transform(request).map_err(to_js_error)?;

    serde_wasm_bindgen::to_value(&response).map_err(to_js_error)
}

fn to_js_error(error: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&error.to_string())
}
