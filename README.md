**什么是AST**
----------

在Vue的mount过程中，template会被编译成AST语法树，AST是指抽象语法树（abstract syntax tree或者缩写为AST），或者语法树（syntax tree），是源代码的抽象语法结构的树状表现形式。

**Virtual Dom**
---------
Vue的一个厉害之处就是利用Virtual DOM模拟DOM对象树来优化DOM操作的一种技术或思路。
Vue源码中虚拟DOM构建经历 template编译成AST语法树 -> 再转换为render函数 最终返回一个VNode(VNode就是Vue的虚拟DOM节点) 
本文通过对源码中AST转化部分进行简单提取，因为源码中转化过程还需要进行各种兼容判断，非常复杂，所以笔者对主要功能代码进行提取，用了300-400行代码完成对template转化为AST这个功能。下面用具体代码进行分析。

```
 function parse(template) {
        var currentParent;    //当前父节点
        var root;            //最终返回出去的AST树根节点
        var stack = [];
        parseHTML(template, {
            start: function start(tag, attrs, unary) {
               ......
            },
            end: function end() {
              ......
            },
            chars: function chars(text) {
               ......
            }
        })
        return root
    }
```

第一步就是调用parse这个方法，把template传进来，这里假设template为 `<div id="app"><span>{{message}}</span></div>`

然后声明3个变量  
currentParent -> 存放当前父元素，root -> 最终返回出去的AST树根节点，stack -> 一个栈用来辅助树的建立
接着调用parseHTML函数进行转化，传入template和options（包含3个方法 start,end,chars 等下用到这3个函数再进行解释）接下来先看parseHTML这个方法

```
 function parseHTML(html, options) {
        var stack = [];    //这里和上面的parse函数一样用到stack这个数组 不过这里的stack只是为了简单存放标签名 为了和结束标签进行匹配的作用
        var isUnaryTag$$1 = isUnaryTag;   //判断是否为自闭合标签
        var index = 0;
        var last;
        while (html) {
            //　　第一次进入while循环时，由于字符串以<开头，所以进入startTag条件，并进行AST转换，最后将对象弹入stack数组中
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
            // // 处理文本
            if (options.chars && text) {
                options.chars(text);
            }
        }
   }
```
函数进入while循环对html进行获取`<`标签索引 `var textEnd = html.indexOf('<');`如果textEnd === 0 说明当前是标签<xxx>或者</xxx> 再用正则匹配是否当前是结束标签</xxx>。`var endTagMatch = html.match(endTag);`  匹配不到那么就是开始标签，调用parseStartTag()函数解析。

```
function parseStartTag() {      //返回匹配对象
    var start = html.match(startTagOpen);         // 正则匹配
    if (start) {
        var match = {
            tagName: start[1],       // 标签名(div)
            attrs: [],               // 属性
            start: index             // 游标索引(初始为0)
        };
        advance(start[0].length);
        var end, attr;
        while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {  
            advance(attr[0].length);  
            match.attrs.push(attr);
        }
        if (end) {
            advance(end[0].length);      // 标记结束位置
            match.end = index;      //这里的index 是在 parseHTML就定义 在advance里面相加
            return match         // 返回匹配对象 起始位置 结束位置 tagName attrs
        }
    }
}

```
该函数主要是为了构建一个match对象，对象里面包含tagName(标签名)，attrs(标签的属性)，start(`<`左开始标签在template中的位置)，end(`>`右开始标签在template中的位置) 如template = `<div id="app"><div><span>{{message}}</span></div></div>` 程序第一次进入该函数 匹配的是div标签  所以tagName就是div
start：0 end:14 如图：
<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/1.png" width="250" height="250"/>


接着把match返回出去 作为调用handleStartTag的参数 

```
var startTagMatch = parseStartTag();    //处理后得到match
if (startTagMatch) {
    handleStartTag(startTagMatch);
    continue
}
```

接下来看handleStartTag这个函数：

```
 function handleStartTag(match) {
    var tagName = match.tagName;
    var unary = isUnaryTag$$1(tagName)  //判断是否为闭合标签 
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
```
函数中分为3部分 第一部分是for循环是对attrs进行转化，我们从上一步的parseStartTag()得到的match对象中的attrs属性如图
<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/2.png" width="250" height="250"/>


当时attrs是上面图这样子滴 我们通过这个循环把它转化为只带name 和 value这2个属性的对象 如图:
<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/3.png" width="250" height="250"/>


接着判断如果不是自闭合标签，把标签名和属性推入栈中（注意 这里的stack这个变量在parseHTML中定义，作用是为了存放标签名 为了和结束标签进行匹配的作用。）接着调用最后一步 options.start 这里的options就是我们在parse函数中 调用parseHTML是传进来第二个参数的那个对象(包含start end chars 3个方法函数) 这里开始看options.start这个函数的作用：

```
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
}
```
这个函数中 生成element对象 再连接元素的parent 和 children节点  最终push到栈中
此时栈中第一个元素生成 如图：
<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/4.png" width="250" height="250"/>




完成了while循环的第一次执行，进入第二次循环执行，这个时候html变成`<span>{{message}}</span></div>` 接着截取到<span> 处理过程和第一次一致 经过这次循环stack中元素如图：


<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/5.png" width="250" height="250"/>
<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/6.png" width="250" height="250"/>



接着继续执行第三个循环 这个时候是处理文本节点了 {{message}}

```
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
// 另外一个函数
if (options.chars && text) {
    options.chars(text);
}
```
这里的作用就是把文本提取出来 调用options.chars这个函数 接下来看options.chars

```
chars: function chars(text) {
    if (!currentParent) {   //如果没有父元素 只是文本
        return
    }

    var children = currentParent.children;  //取出children
    // text => {{message}}
    if (text) {
        var expression;
        if (text !== ' ' && (expression = parseText(text))) {
            // 将解析后的text存进children数组
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
```
这里的主要功能是判断文本是{{xxx}}还是简单的文本xxx,如果是简单的文本 push进父元素的children里面，type设置为3，如果是字符模板{{xxx}}，调用parseText转化。如这里的`{{message}}`转化为 `_s(message)`(加上_s是为了AST的下一步转为render函数，本文中暂时不会用到。) 再把转化后的内容push进children。

<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/7.png" width="250" height="250"/>


又走完一个循环了，这个时候html = `</span></div>` 剩下2个结束标签进行匹配了 

```
  var endTagMatch = html.match(endTag);
    if (endTagMatch) {
        var curIndex = index;
        advance(endTagMatch[0].length);
        parseEndTag(endTagMatch[1], curIndex, index);
        continue
    }
```
接下来看parseEndTag这个函数 传进来了标签名 开始索引和结束索引

```
  function parseEndTag(tagName, start, end) {
    var pos, lowerCasedTagName;
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
}
```
这里首先找到栈中对应的开始标签的索引pos，再从该索引开始到栈顶的所以元素调用options.end这个函数

```
 end: function end() {
    // pop stack
    stack.length -= 1;
    currentParent = stack[stack.length - 1];
},
```
把栈顶元素出栈，因为这个元素已经匹配到结束标签了，再把当前父元素更改。终于走完了，把html的内容循环完，最终return root 这个root就是我们所要得到的AST
<img src="https://github.com/zwStar/vue-ast/blob/master/screenshots/8.png" width="250" height="250"/>


这只是Vue的冰山一角，文中有什么不对的地方请大家帮忙指正，本人最近也一直在学习Vue的源码，希望能够拿出来与大家一起分享经验，接下来会继续更新后续的源码，如果觉得有帮忙请给个Star哈

## 项目运行
```
git clone https://github.com/zwStar/vue-ast

打开demo.html 

F12打开控制台 然后在input中输入template 控制台可以看到转换后的AST树

```

