use std::ffi::{c_char, c_void};

unsafe extern "C" {
    fn objc_getClass(name: *const c_char) -> *mut c_void;
    fn sel_registerName(name: *const c_char) -> *mut c_void;
    fn class_addMethod(
        class: *mut c_void,
        selector: *mut c_void,
        implementation: unsafe extern "C" fn(*mut c_void, *mut c_void, *mut c_void) -> c_char,
        types: *const c_char,
    ) -> c_char;
}

unsafe extern "C" fn accepts_first_mouse(
    _view: *mut c_void,
    _selector: *mut c_void,
    _event: *mut c_void,
) -> c_char {
    1
}

pub fn enable_first_click_for_webviews() -> Result<(), &'static str> {
    let web_view_class = unsafe { objc_getClass(c"WKWebView".as_ptr()) };
    if web_view_class.is_null() {
        return Err("WKWebView class is unavailable");
    }

    let selector = unsafe { sel_registerName(c"acceptsFirstMouse:".as_ptr()) };
    let added = unsafe {
        class_addMethod(
            web_view_class,
            selector,
            accepts_first_mouse,
            c"c@:@".as_ptr(),
        )
    };

    if added == 0 {
        return Err("could not enable first-click handling for WKWebView");
    }

    Ok(())
}
