# Sass-Embed


## Different ways to load in SASS
You can load in SASS in several different ways. The list below is in order of precedence, so inputs higher up will override those lower down
 - postMessage
 - querystring
 - inline tag:
    ```html
    <pre class="language-scss input" style="display:none;">
    body {
        div {
            background-color: green;
        }
    }
    </pre>
    ```

## Configuration Parameters
Query Key | postMessage Key | Description
--- | --- | --- | ---
`autorun` | NA | *Option*: If SASS should be continuously converted as user types in SASS input area.<br><br>Use "true" or "false" string for query key.
`readonly` | NA | *Option*: If input SASS panel should be set to readonly mode
`sassString` | `sassString` | The literal string of SASS to convert to CSS
`indented` | `indented` | If the SASS input is original indented syntax, or SCSS flavor.<br><br>Use boolean in postMessage, use "true"|"false" string in query key.