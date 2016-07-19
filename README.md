# stc-plugin

Abstract plugin class for stc

## 属性

### file

文件对象，文件包含的属性和方法见 [stc-file](https://github.com/stcjs/stc-file)。

### options

配置选项，即 `stc.config.js` 里设置的调用该插件的配置。


### include

插件的 include 配置。

### matches

插件的 include 配置匹配到的值。

### stc

stc 对象。

### TokenType

HTML 和 CSS 的 Token 类型，具体见 <https://github.com/welefen/flkit#tokentype>。


## 方法

### getContent(encoding)

* `encoding` {String | null} 文件编码，默认为 `null`
* `return` {Promise<String>}

获取文件的内容，如果没有设置 `encoding`，那么获取到的为文件内容对应的 Buffer。

```js
export default class xxxPlugin extends Plugin {
  async run(){
    let content = await this.getContent('utf8');
  }
}
```

### setContent(content)

设置文件的内容。设置内容时，会清除掉文件已有的 AST。

该方法只能在插件的 `update` 方法里调用。

```js
export default class xxxPlugin extends Plugin {
  update(content){
    this.setContent(content);
  }
}
```


### getAst()

* `return` {Promise<Array | Object>}

获取文件内容对应的 AST，对于 HTML 和 CSS，获取到的是 Token 列表。

```js
export default class xxxPlugin extends Plugin {
  async run(){
    let tokens = await this.getAst();
  }
}
```

### setAst()

设置文件的 AST，设置 AST 时，会清除调文件的内容。

该方法只能在插件的 `update` 方法里调用。

```js
export default class xxxPlugin extends Plugin {
  update(ast){
    this.setAst(ast);
  }
}
```

### addDependence(dependencies)

给当前文件添加资源依赖。

### getDependence(file)

* `file` 默认为当前处理的文件

获取文件的依赖。

### addFile(file)

* `file` {String | Array}

添加一个文件到资源池中，如：多张小图片合并成一张大图片，需要将大图片添加到资源池中。

### getFileByPath(filepath)

* `filepath` {String}
* `return` {stc-file}

通过路径获取 stc-file 对象。

```js
export default class xxxPlugin extends Plugin {
  async run(){
    let file = this.getFileByPath('/resource/css/a.css');
  }
}
```

### invokeSelf(file)

* `file` {String | stc-file}
* `return` {Promise<any>}

对另一个文件执行当前插件。返回结果为该插件 `run` 方法的返回值。

```js
export default class xxxPlugin extends Plugin {
  async run(){
    let ret = await this.invokeSelf('/resource/css/a.css');
  }
}
```

### invokePlugin(plugin, file)

* `plugin` {Class}
* `file` {String | stc-file}
* `return` {Promise<any>}

调用另一个插件。返回结果为调用插件 `run` 方法的返回值。

```js
import yyyPlugin from 'stc-yyy';

export default class xxxPlugin extends Plugin {
  async run(){
    let ret = await this.invokePlugin(yyyPlugin, '/resource/css/a.css');
  }
}
```

### asyncReplace(content, replace, callback)

* `content` {String}
* `replace` {RegExp}
* `callback` {Function}
* `return` {Promise<String>}

通过正则异步替换内容，如：匹配内容中的地址，然后上传的 CDN，获取新的 URL 替换回去。

```js
export default class xxxPlugin extends Plugin {
  async run(){
    let ret = await this.asyncReplace(content, /(\w+)\.js/, async (a, b) => {
      let url = await getRemoteUrl(a, b);
      if(url.indexOf('//') === 0){
        url = 'http:' + url;
      }
      return url;
    })
  }
}
```

### cache(name, value)

* `name` {String}
* `value` {any}
* `return` {Promise<any>}

设置或者获取缓存。

```js
// 读取缓存
export default class xxxPlugin extends Plugin {
  async run(){
    let value = await this.cache('cacheKey');
  }
}
```

```js
// 设置缓存
export default class xxxPlugin extends Plugin {
  async run(){
    let value = await this.cache('cacheKey', 'cacheData');
  }
}
```

插件执行过程中，每个文件之间是并行执行的，如果想让有些缓存在文件之间可以公用，可以通过下面的方式。

```js
export default class xxxPlugin extends Plugin {
  async run(){
    let value = await this.cache('cacheKey', () => {
      // 这里是返回缓存值的具体逻辑
      return 'cacheData';
    });
  }
}
```


### concurrentLimit(fn, ignoreErrorFn, limit, key)

* `fn` {Function} 待执行的函数
* `ignoreErrorFn` {Function} 出现错误后，哪些错误可以忽略的函数判断
* `limit` {Number} 初始限制的数量
* `key` {String} 默认为当前插件的名称

任务队列，避免并行任务开的太多导致报错。

```js
this.concurrentLimit(() => {
  return execFile(opt.adapter, args);
}, err => {
  // 忽略这个错误
  if(err.code === 'EAGAIN'){
    return true;
  }
}, 10);
```


### createToken(type, value, referToken)

创建一个 Token，具体见：https://github.com/stcjs/flkit#createtokentype-value-refertoken

### createRawToke(type, value, referToken)

创建一个 Raw Token，具体见：https://github.com/stcjs/flkit#createrawtokentype-value-refertoken

### fatal(message, line, column, file = this.file)

抛出一个 fatal 错误，程序不再往下执行。

```js
this.fatal('file not exist', 1, 1);
```

### error(message, line, column, file = this.file)

输出一条错误信息，程序继续执行。

只能在 `update` 方法中调用。

```js
this.error('src value can not be blank', 1, 2);
```

### warning(message, line, column, file = this.file)

输出一条警告信息，程序继续执行。

只能在 `update` 方法中调用。


### notice(message, line, column, file = this.file)

输出一条提示信息，程序继续执行。

只能在 `update` 方法中调用。

### run()

执行方法。耗时的任务在 `run` 里执行，然后将结果返回给 `update` 方法更新。

### update(data)

更新方法，该方法里只能调用常用的方法，不能调用插件扩展的方法。

该方法的参数值即为 `run` 方法的返回值。

```js
update(data){
  this.setAst(data);
}
```



## 静态方法

### include()

设置默认的 include

```js
export default class extends StcPlugin {
  /**
   * default include 
   */
  static include(){
    return /\.js/;
  }
}
```

### cluster()

是否开启 cluster。

```js
export default class extends StcPlugin {
  static cluster(){
    return true;
  }
}
```

### cache()

是否开启 cache。

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


