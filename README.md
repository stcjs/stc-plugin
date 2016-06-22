# stc-plugin

Abstract plugin class for stc

## 属性

### file

文件对象，文件包含的属性和方法见 [stc-file](https://github.com/stcjs/stc-file)。

### options

配置选项，即 `stc.config.js` 里设置的调用该插件的配置。

### stc

stc 对象。

### TokenType

HTML 和 CSS 的 Token 类型，具体见 <https://github.com/welefen/flkit#tokentype>。

### ext

扩展的一些属性，插件里一般用不到，系统调用时可能会使用。

## 方法

### getContent(encoding)

* `encoding` 文件编码，默认为 `null`

获取文件的内容，如果没有设置 `encoding`，那么获取到的为文件内容对应的 Buffer。

### setContent(content)

设置文件的内容。设置内容时，会清除掉文件已有的 AST。

### getAst()

获取文件内容对应的 AST，对于 HTML 和 CSS，获取到的是 Token 列表。

### setAst()

设置文件的 AST，设置 AST 时，会清除调文件的内容。

### addDependence(dependencies)

给当前文件添加资源依赖。

### getDependence(file)

* `file` 默认为当前处理的文件

获取文件的依赖。

### addFile(file)

添加一个文件到资源池中，如：多张小图片合并成一张大图片，需要将大图片添加到资源池中。

### getFileByPath(filepath)

通过路径获取 stc-file 对象。

### invokeSelf(file)

对另一个文件执行当前插件。

### invokePlugin(plugin, file)

调用另一个插件。

### asyncReplace(content, replace, callback)

通过正则异步替换内容，如：匹配内容中的地址，然后上传的 CDN，获取新的 URL 替换回去。

### fatal(message, line, column, file = this.file)

抛出一个 fatal 错误。

### error(message, line, column, file = this.file)

输出一条错误信息。

### warning(message, line, column, file = this.file)

输出一条警告信息。

### notice(message, line, column, file = this.file)

输出一条提示信息。

### run()

执行方法。

### update()

更新方法。

## 静态方法

### cluster()

开启 cluster。

```js
export default class extends StcPlugin {
  static cluster(){
    return true;
  }
}
```

### cache()

开启 cache。

```js
export default class extends StcPlugin {
  static cache(){
    return true;
  }
}
```

### after(files, instance)

* `files` 该插件匹配到的所有文件
* `instance` 当前插件的实例

插件对单一文件处理完后的统一处理。


