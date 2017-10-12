(function (global, factory) {
    (global.Parse = factory())
}(this, (function () {
    var ncname = '[a-zA-Z_][\\w\\-\\.]*';
    var qnameCapture = '((?:' + ncname + '\\:)?' + ncname + ')';
    var startTagOpen = new RegExp('^<' + qnameCapture); //匹配开始标签的 <
    var startTagClose = /^\s*(\/?)>/;       //匹配 开始标签的 >
    var endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>'); //匹配结束标签 </xxx>

// Regular Expressions for parsing tags and attributes
    var singleAttrIdentifier = /([^\s"'<>/=]+)/;
    var singleAttrAssign = /(?:=)/;
    var singleAttrValues = [
        // attr value double quotes
        /"([^"]*)"+/.source,
        // attr value, single quotes
        /'([^']*)'+/.source,
        // attr value, no quotes
        /([^\s"'=<>`]+)/.source
    ];
    var attribute = new RegExp(
        '^\\s*' + singleAttrIdentifier.source +
        '(?:\\s*(' + singleAttrAssign.source + ')' +
        '\\s*(?:' + singleAttrValues.join('|') + '))?'
    );

    var defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g;  //匹配 {{xxxx}}
    function makeMap(str,
                     expectsLowerCase    //true
    ) {
        var map = Object.create(null);      //创建一个对象
        var list = str.split(',');
        for (var i = 0; i < list.length; i++) {
            map[list[i]] = true;
        }
        return expectsLowerCase
            ? function (val) {
                return map[val.toLowerCase()];
            }
            : function (val) {
                return map[val];
            }
    }

    var isUnaryTag = makeMap(   // 自闭合标签
        'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
        'link,meta,param,source,track,wbr'
    );

    function Parse(template) {
        return this._init(template);
    }
    function parseHTML(html, options) {
        var stack = [];
        var isUnaryTag$$1 = isUnaryTag;   //判断是否为自闭合标签
        var index = 0;
        var last, lastTag;    //lastTag 为了匹配结束标签 因为执行一次后 lastTag会被赋值tagName
        while (html) {
            //　　第一次进入while循环时，由于字符串以<开头，所以进入startTag条件，并进行AST转换，最后将对象弹入stack数组中
            //　　而这一次，字符串开头为{，所以会继续执行下面的代码。代码将{{message}}作为text抽离出来，并调用了参数中另外一个函数：options
            last = html;
            var textEnd = html.indexOf('<');
            if (textEnd === 0) {     // 此时字符串是不是以<开头
                // End tag:
                var endTagMatch = html.match(endTag);
                if (endTagMatch) {
                    var curIndex = index;
                    advance(endTagMatch[0].length);
                    parseEndTag(endTagMatch[1], curIndex, index);
                    continue
                }

                // Start tag:    // 匹配起始标签
                var startTagMatch = parseStartTag();    //处理后得到match
                if (startTagMatch) {
                    handleStartTag(startTagMatch);
                    continue
                }
            }

            // 初始化为undefined 这样安全且字符数少一点
            var text = (void 0), rest = (void 0), next = (void 0);
            if (textEnd >= 0) {      // 截取<字符索引 => </div> 这里截取到闭合的<
                rest = html.slice(textEnd);  //截取闭合标签
                // 处理文本中的<字符
                // 获取中间的字符串 => {{message}}
                text = html.substring(0, textEnd); //截取到闭合标签前面部分
                advance(textEnd);               //切除闭合标签前面部分

            }
            // 当字符串没有<时
            if (textEnd < 0) {
                text = html;
                html = '';
            }
            // // 另外一个函数
            if (options.chars && text) {
                options.chars(text);
            }
        }

        // 该函数将函数局部变量index往前推 并切割字符串
        function advance(n) {
            index += n;
            html = html.substring(n);
        }

        function parseStartTag() {      //返回匹配对象
            var start = html.match(startTagOpen);         // 正则匹配
            if (start) {
                var match = {
                    tagName: start[1],       // 标签名(div)
                    attrs: [],               // 属性
                    start: index             // 游标索引(初始为0)
                };
                advance(start[0].length);
                var end, attr;       // 进行属性的正则匹配
                // startTagClose匹配/>或>          attribute匹配属性 正则太长 没法讲           本例中attr匹配后 => ['id=app','id','=','app']
                while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {  //如果不是 > 标签  并且是attribute 比如<div id=app> 先得到app 第二次while 的dao>
                    advance(attr[0].length);         // 属性加入
                    match.attrs.push(attr);
                }
                if (end) {      //  第一while匹配到 attr 第二次就能end到                在第二次while循环后 end匹配到结束标签 => ['>','']
                    // match.unarySlash = end[1];      //如果是> end[1]就是"" 如果过 div> end[1] 就是div
                    advance(end[0].length);      // 标记结束位置
                    match.end = index;      //这里的index 是在 parseHTML就定义 在advance里面相加
                    return match         // 返回匹配对象 起始位置 结束位置 tagName attrs
                }
            }
        }

        function handleStartTag(match) {
            var tagName = match.tagName;
            // var unarySlash = match.unarySlash;
            // if (expectHTML) {
            //     if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
            //         parseEndTag(lastTag);
            //     }
            //     if (canBeLeftOpenTag$$1(tagName) && lastTag === tagName) {
            //         parseEndTag(tagName);
            //     }
            // }
            var unary = isUnaryTag$$1(tagName)
            var l = match.attrs.length;
            var attrs = new Array(l);
            for (var i = 0; i < l; i++) {
                var args = match.attrs[i];
                var value = args[3] || args[4] || args[5] || '';
                attrs[i] = {
                    name: args[1],
                    value: value
                };
            }
            if (!unary) {
                stack.push({tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs});
                lastTag = tagName;
            }
            if (options.start) {
                options.start(tagName, attrs, unary, match.start, match.end);
            }
        }

        function parseEndTag(tagName, start, end) {
            // 参数修正
            var pos, lowerCasedTagName;
            if (start == null) {
                start = index;
            }
            if (end == null) {
                end = index;
            }

            if (tagName) {
                lowerCasedTagName = tagName.toLowerCase();
            }

            // Find the closest opened tag of the same type
            if (tagName) { // 获取最近的匹配标签
                for (pos = stack.length - 1; pos >= 0; pos--) {
                    // 提示没有匹配的标签
                    if (stack[pos].lowerCasedTag === lowerCasedTagName) {
                        break
                    }
                }
            } else {
                // If no tag name is provided, clean shop
                pos = 0;
            }

            if (pos >= 0) {
                // Close all the open elements, up the stack
                for (var i = stack.length - 1; i >= pos; i--) {
                    if (options.end) {
                        options.end(stack[i].tag, start, end);
                    }
                }

                // Remove the open elements from the stack
                stack.length = pos;
                lastTag = pos && stack[pos - 1].tag;
            } else if (lowerCasedTagName === 'br') {
                if (options.start) {
                    options.start(tagName, [], true, start, end);
                }
            } else if (lowerCasedTagName === 'p') {
                if (options.start) {
                    options.start(tagName, [], false, start, end);
                }
                if (options.end) {  // 调用剩下的一个参数函数
                    options.end(tagName, start, end);
                }
            }
        }
    }
    function parse(template) {
        var currentParent;
        var root;
        var stack = [];
        parseHTML(template, {
            start: function start(tag, attrs, unary) {
                var element = {
                    type: 1,
                    tag: tag,
                    attrsList: attrs,
                    attrsMap: makeAttrsMap(attrs),
                    parent: currentParent,
                    children: []
                };
                processAttrs(element);
                if (!root) {
                    root = element;
                }
                if(currentParent){
                    currentParent.children.push(element);
                    element.parent = currentParent;
                }
                if (!unary) {
                    currentParent = element;
                    stack.push(element);
                }
            },
            end: function end() {
                // remove trailing whitespace
                var element = stack[stack.length - 1];        /*从stack中取出最后一个ele*/
                var lastNode = element.children[element.children.length - 1];    /*获取该ele的最后一个子节点*/
                //  /*该子节点是非<pre>标签的文本*/
                if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
                    element.children.pop();
                }
                // pop stack
                stack.length -= 1;
                currentParent = stack[stack.length - 1];
            },
            chars: function chars(text) {
                if (!currentParent) {   //如果没有父元素 只是文本
                    return
                }

                var children = currentParent.children;  //取出children
                // text => {{message}}
                if (text) {
                    var expression;
                    if (text !== ' ' && (expression = parseText(text))) {
                        // 将解析后的text弄进children数组
                        children.push({
                            type: 2,
                            expression: expression,
                            text: text
                        });
                    } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
                        children.push({
                            type: 3,
                            text: text
                        });
                    }
                }
            }
        })
        return root
    }
    //　在最后，调用processAttrs对动态绑定的属性（v-,@,:）进行处理，代码如下：
    function processAttrs(el) {
        // {name:'id',value:'app'}
        /*获取元素属性列表*/
        var list = el.attrsList;
        var i, l, name, rawName, value, modifiers, isProp;
        for (i = 0, l = list.length; i < l; i++) {
            // 属性名
            name = rawName = list[i].name;
            // 属性值
            value = list[i].value;
            addAttr(el, name, JSON.stringify(value));        // 添加了个attrs属性  /*将属性放入ele的attr属性中*/
        }
    }

    function addAttr(el, name, value) {
        (el.attrs || (el.attrs = [])).push({name: name, value: value});
    }
    function parseText(text,    //对Text进行解析
                       delimiters) {
        var tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE;       // 如果delimiters为false defaultTagRE 为匹配{{xxx}}的正则
        if (!tagRE.test(text)) {        // /\{\{((?:.|\n)+?)\}\}/g 在这里调用test方法后lasatIndex会变化
            return
        }
        var tokens = [];
        var lastIndex = tagRE.lastIndex = 0;
        var match, index;

        // 0:"{{message}}"
        // 1:"message"
        // index:0
        // input:"{{message}}"

        // 匹配到中间的文本
        while ((match = tagRE.exec(text))) {
            index = match.index;
            // push text token
            // 将{{message}}之前的文本push进去
            if (index > lastIndex) {
                tokens.push(JSON.stringify(text.slice(lastIndex, index)));
            }
            // tag token
            // 该方法对特殊字符进行处理
            var exp = (match[1].trim());
            tokens.push(("_s(" + exp + ")"));
            lastIndex = index + match[0].length;
        }
        if (lastIndex < text.length) {       // push}}后面的文本
            tokens.push(JSON.stringify(text.slice(lastIndex)));
        }
        return tokens.join('+')
    }

    function makeAttrsMap(attrs) {
        var map = {};
        for (var i = 0, l = attrs.length; i < l; i++) {
            map[attrs[i].name] = attrs[i].value;
        }
        return map
    }
    Parse.prototype._init = function(template){
        return parse(template)
    }
    return Parse;
})));








