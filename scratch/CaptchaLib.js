function DrawCaptcha(elem,size) {
    var a = Math.ceil(Math.random() * 9) + '';
    var b = Math.ceil(Math.random() * 9) + '';
    var c = Math.ceil(Math.random() * 9) + '';
    var d = Math.ceil(Math.random() * 9) + '';
    var e = Math.ceil(Math.random() * 9) + '';
    var f = Math.ceil(Math.random() * 9) + '';
    var g = Math.ceil(Math.random() * 9) + '';
    var h = Math.ceil(Math.random() * 9) + '';
    var i = Math.ceil(Math.random() * 9) + '';
    var j = Math.ceil(Math.random() * 9) + '';
    var code = "0";
    var cptLength = size;
    if (cptLength == '1') {
        code = a;
    }
    else if (cptLength == '2') {
        code = a + ' ' + b;
    }
    else if (cptLength == '3') {
        code = a + ' ' + b + ' ' + c;
    }
    else if (cptLength == '4') {
        code = a + ' ' + b + ' ' + c + ' ' + d;

    }
    else if (cptLength == '5') {
        code = a + ' ' + b + ' ' + c + ' ' + d + ' ' + e;
    }
    else if (cptLength == '6') {
        code = a + ' ' + b + ' ' + c + ' ' + d + ' ' + e + ' ' + f;
    }
    else if (cptLength == '7') {
        code = a + ' ' + b + ' ' + c + ' ' + d + ' ' + e + ' ' + f + ' ' + g;
    }
    else if (cptLength == '8') {
        code = a + ' ' + b + ' ' + c + ' ' + d + ' ' + e + ' ' + f + ' ' + g + ' ' + h;
    }
    else if (cptLength == '9') {
        code = a + ' ' + b + ' ' + c + ' ' + d + ' ' + e + ' ' + f + ' ' + g + ' ' + h + ' ' + i;
    }
    else if (cptLength == '10') {
        code = a + ' ' + b + ' ' + c + ' ' + d + ' ' + e + ' ' + f + ' ' + g + ' ' + h + ' ' + i + ' ' + j;
    }
    else { code = a + ' ' + b + ' ' + c; } //default}

    document.getElementById(elem).value = code;
}

function fn_refresh_captcha() {
    DrawCaptcha();
}