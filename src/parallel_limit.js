import {defer} from 'stc-helper';
/**
 * parallel task dynamic limit
 */
export default class ParallelTaskLimit {
  /**
   * contructor
   */
  constructor(initLimit = 5, ignoreErrorFn){
    if(typeof initLimit === 'function'){
      ignoreErrorFn = initLimit;
      initLimit = 5;
    }
    this.limit = initLimit;
    this.ignoreErrorFn = ignoreErrorFn;
    this.doing = 0;
    this.index = 0;
    this.deferreds = [];
    this.hasDecrement = false;
  }
  /**
   * is ignore error
   */
  isIgnoreError(err){
    if(!this.ignoreErrorFn){
      return false;
    }
    return this.ignoreErrorFn(err);
  }
  /**
   * next 
   */
  next(flag, item){
    if(flag === false){
      this.limit--;
    }else if(flag === true && !this.hasDecrement){
      this.limit++;
    }
    this.doing--;
    if(flag === false){
      this.deferreds.push(item); 
      this.hasDecrement = true;
    }
    if(flag){
      this._runTask();
    }
    this._runTask();
  }
  /**
   * run task
   */
  _runTask(){
    if(this.doing >= this.limit || this.index >= this.deferreds.length){
      if(this.doing === 0){
        this.index = 0;
        this.deferreds = [];
      }
      return;
    }
    this.doing++;
    let item = this.deferreds[this.index++];
    let result = Promise.resolve(item.fn());
    return result.then(data => {
      item.deferred.resolve(data);
      this.next(true);
    }).catch(err => {
      if(this.isIgnoreError(err) && this.limit > 1){
        this.next(false, item);
      }else{
        item.deferred.reject(err);
        this.next();
      }
    });
  }
  /**
   * run task
   */
  run(fn){
    let deferred = defer();
    this.deferreds.push({
      deferred,
      fn
    });
    this._runTask();
    return deferred.promise;
  }
}