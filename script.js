
SCRIPT_JS_LOADED = true;
CODEFLASK_USE_DEF_THEME = false;

// Setup code editor
inputFlask = new CodeFlask('#sass-input', {
    language: 'scss',
    lineNumbers: false,
    readonly: false,
    defaultTheme: CODEFLASK_USE_DEF_THEME
});
outputFlask = new CodeFlask('#css-output', {
    language: 'css',
    lineNumbers: false,
    readonly: true,
    defaultTheme: CODEFLASK_USE_DEF_THEME
});

// Setup split js
Split(['#sass-input-wrapper','#css-output-wrapper'],{
    sizes: [50,50],
    direction: 'horizontal',
    gutterSize: 10
});

// common elements & globals
var indentCheckbox = document.getElementById('indentCheckbox');
var convertButton = document.querySelector('#convertButton');
var sassInputWrapper = document.querySelector('#sass-input-wrapper');
var sassInputElem = sassInputWrapper.querySelector('textarea');
var topBarElem = document.querySelector('#topbar');
var autorunCheckbox = document.querySelector('#autorunCheckbox');
var compilingStatusElem = document.querySelector('#compilingStatus');
var AUTORUN_ON = false;
var DEBOUNCE_TIMER = null;
var DEBOUNCE_WAIT_MS = 1000*2;
var LAST_INPUT_MS = 0;
// Global - can touch parent window (or not due to Cross-Origin)
var CAN_TOUCH_PARENT = false;

// Copy theme details over if not using default theme
if (!CODEFLASK_USE_DEF_THEME){
    var injectDelay = 0;
    if (document.querySelectorAll('link[href*="prism-okaidia"]').length < 1){
        injectDelay = 1500;
        var linkElem = document.createElement('link');
        linkElem.rel = 'stylesheet';
        linkElem.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.16.0/themes/prism-okaidia.min.css';
        document.body.appendChild(linkElem);
    }
    setTimeout(function(){
        var computedStyles = getComputedStyle(sassInputWrapper.querySelector('pre[class*="language-"]'));
        var injectedStyleText = '' + 
        '.codeflask {' +
            'background-color: ' + computedStyles.backgroundColor + ';' +
        '}' + 
        '.codeflask textarea {' +
            'caret-color: white;' +
            'padding: ' + computedStyles.padding + ';' +
            'border-radius: ' + computedStyles.borderRadius + ';' +
            'font-family: ' + computedStyles.fontFamily + ';' +
            'font-size: ' + computedStyles.fontSize + ';' +
            'line-height: ' + computedStyles.lineHeight + ';' +
            'z-index: 5;' +
            'color: transparent;' +
        '}';
        var styleElem = document.createElement('style');
        styleElem.innerText = injectedStyleText;
        document.body.appendChild(styleElem);
    },injectDelay);   
}

// Sass service worker
SASS_SERVICE_WORKER_PATH = 'https://cdnjs.cloudflare.com/ajax/libs/sass.js/0.11.0/sass.worker.min.js';
// Sass options
Sass.options({
    style: Sass.style.expanded
});

/**
 * Add event listeners and auto-run
 */
window.addEventListener('message',postMessageReceiver);
if (self !== top){
    try {
        parent.window.addEventListener('message',postMessageReceiver);
        removeHeader();
        CAN_TOUCH_PARENT = true;
    }
    catch (e){
        console.group('Unable to attach listener to parent window');
            console.log(e);
        console.groupEnd();
    }
}
convertButton.addEventListener('click',function(evt){
    inputToOutput();
});
autorunCheckbox.addEventListener('click',function(evt){
    toggleAutoRun(autorunCheckbox.checked);
});
inputFlask.onUpdate(function(code){
    LAST_INPUT_MS = (new Date()).getTime();
    if (DEBOUNCE_TIMER){
        clearTimeout(DEBOUNCE_TIMER);
    }
    DEBOUNCE_TIMER = setTimeout(function(){
        if (AUTORUN_ON){
            inputToOutput();
        }
    },DEBOUNCE_WAIT_MS);
});
// Load from query string first, then if abset, look for inline
if (!loadFromQueryString()){
    loadFromInlineTag();
}

function inputToOutput(){
    var inputSass = sassInputElem.value;
    parseSassAndShow(inputSass, indentCheckbox.checked);
}

function postMessageReceiver(msgEvent){
    if (/sassString/.test(msgEvent.data) && /^\{.*\}$/.test(msgEvent.data)){
        console.log(msgEvent);
        try {
            var payload = JSON.parse(msgEvent.data);
            if ('sassString' in payload){
                var indentedSyntax = typeof(payload.indented)==='boolean' ? payload.indented : false;
                indentCheckbox.checked = indentedSyntax;
                parseSassAndShow(payload.sassString, indentedSyntax, true);
            }
        }
        catch (e){
            console.log(e);
        }
    }
}

function loadFromQueryString(){
    var sassQueryVal = getUrlParameter('sassString',window.location.search);
    var indentendInputStr = getUrlParameter('indented',window.location.search);
    var autoRunOnStr = getUrlParameter('autorun',window.location.search);
    if (!sassQueryVal && CAN_TOUCH_PARENT){
        sassQueryVal = getUrlParameter('sassString',parent.window.location.search);
        indentendInputStr = getUrlParameter('indented',window.location.search);
        autoRunOnStr = getUrlParameter('autorun',window.location.search);
    }
    // Default to indentend input = false
    // Default to autorun = false;
    var indentedInputBool = (indentendInputStr && indentendInputStr.toLowerCase()==='true');
    var autoRunOnBool = (autoRunOnStr && autoRunOnStr.toLowerCase()==='true');
    indentCheckbox.checked = indentedInputBool;
    AUTORUN_ON = autoRunOnBool;
    if (sassQueryVal){
        var sassString = sassQueryVal;
        parseSassAndShow(sassQueryVal, indentedInputBool, true);
        return true;
    }
    return false;
}

function loadFromInlineTag(){
    var indentedTag = document.querySelector('pre[class*="language-sass"][class*="input"]');
    var regularTag = document.querySelector('pre[class*="language-scss"][class*="input"]');
    var finalTag = indentedTag ? indentedTag : regularTag;
    if (finalTag){
        var code = finalTag.innerText;
        parseSassAndShow(code, Boolean(indentedTag), true);
        return true;
    }
    return false;
}

function parseSassAndShow(sassString, indentedSyntax, updateInput){
    toggleCompileStatus(true);
    if (updateInput){
        inputFlask.updateCode(sassString);
    }
    var usingSync = document.querySelectorAll('script[src*="sass.sync.min.js"]').length > 0;
    console.log(sassString);
    var sassInstance = null;
    if (usingSync){
        sassInstance = Sass;
    }
    else {
        sassInstance = new Sass(SASS_SERVICE_WORKER_PATH);
    }
    if (Sass._options.indentedSyntax !== indentedSyntax){
        Sass.options({indentedSyntax:indentedSyntax});
    }
    try {
        sassInstance.compile(sassString, function(res){
            console.log(res);
            if (res.text){
                showOutputCss(res.text);
            }
            else {
                showOutputCss('Unable to parse input');
            }
        });
    }
    catch (e){
        showOutputCss('Unable to parse input:\n\n' + e);
    }
}

function showOutputCss(cssString){
    toggleCompileStatus(false);
    outputFlask.updateCode(cssString);
}

function getUrlParameter(e, searchStr){e=e.replace(/[\[]/,"\\[").replace(/[\]]/,"\\]");var r=new RegExp("[\\?&]"+e+"=([^&#]*)").exec(searchStr);return null===r?"":decodeURIComponent(r[1].replace(/\+/g," "))}

function removeHeader(){
    parent.document.querySelector('header').remove();
    var injectedStyleText = '#tabs,#tabs #result{margin-top:0;height:100vh}';
    var injectedStyleTag = document.createElement('style');
    injectedStyleTag.innerText = injectedStyleText;
    parent.document.body.appendChild(injectedStyleTag);
}

function toggleAutoRun(setAutorunOn){
    AUTORUN_ON = setAutorunOn;
}
function toggleCompileStatus(status){
    if (status){
        compilingStatusElem.style.display = 'initial';
        compilingStatusElem.style.opacity = 1;
    }
    else {
        compilingStatusElem.style.opacity = 0;
        setTimeout(function(){
            compilingStatusElem.style.display = 'none';
        },1000);
    }
}
/**
 * Todo
 *  - Build embed gen tool
 *  - Readonly mode for input
 */