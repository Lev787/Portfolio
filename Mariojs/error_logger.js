window.onerror = function(msg, url, lineNo, columnNo, error) {
    if (window.parent) {
        window.parent.postMessage({action: "error", msg: msg + " at " + url + ":" + lineNo + ":" + columnNo}, "*");
    } else {
        alert(msg);
    }
};
