import {asyncReplace} from 'stc-helper';

/**
 * stc plugin abstract class
 */
export default class {
  /**
   * constructor
   */
  constructor(file){
    this.file = file;
  }
  /**
   * async content replace
   */
  replace(content = '', replace, callback){
    return asyncReplace(content, replace, callback);
  }
  /**
   * run
   */
  run(){
    
  }
  static include(){
    
  }
  static exclude(){
    
  }
}