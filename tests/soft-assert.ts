import { AssertionError } from 'assert';
import path from 'path';
function stackTraceFilter() {
  // TODO: Replace with `process.browser`
  const is = typeof document === 'undefined' ? { node: true } : { browser: true };
  let slash = path.sep;
  let cwd;
  if (is.node) {
    cwd = process.cwd() + slash;
  } else {
    cwd = (typeof location === 'undefined' ? window.location : location).href.replace(/\/[^/]*$/, '/');
    slash = '/';
  }

  function isMochaInternal(line) {
    return ~line.indexOf('node_modules' + slash + 'mocha' + slash) || ~line.indexOf(slash + 'mocha.js') || ~line.indexOf(slash + 'mocha.min.js');
  }

  function isNodeInternal(line) {
    return (
      ~line.indexOf('(timers.js:') ||
      ~line.indexOf('(events.js:') ||
      ~line.indexOf('(node.js:') ||
      ~line.indexOf('(module.js:') ||
      ~line.indexOf('GeneratorFunctionPrototype.next (native)') ||
      false
    );
  }

  return function (stack: string) {
    const stackSplit = stack.split('\n');

    const stackFiltered = stackSplit.reduce(function (list, line) {
      if (isMochaInternal(line)) {
        return list;
      }

      if (is.node && isNodeInternal(line)) {
        return list;
      }

      // Clean up cwd(absolute)
      if (/:\d+:\d+\)?$/.test(line)) {
        line = line.replace('(' + cwd, '(');
      }

      list.push(line);
      return list;
    }, [] as string[]);

    return stackFiltered.join('\n');
  };
}
type Fn = (...args: unknown[]) => unknown;
function formatAssertionError(err: any) {
  let msg: string;
  let message: string | any[];
  if (err.message && typeof err.message.toString === 'function') {
    message = err.message + '';
  } else if (typeof err.inspect === 'function') {
    message = err.inspect() + '';
  } else {
    message = '';
  }
  let stack = err.stack || message;
  let index = message ? stack.indexOf(message) : -1;

  if (index === -1) {
    msg = message;
  } else {
    index += message.length;
    msg = stack.slice(0, index);
    stack = stack.slice(index + 1);
  }

  if (err.uncaught) {
    msg = 'Uncaught ' + msg;
  }
  const mochaStackTraceFilter = stackTraceFilter();
  stack = mochaStackTraceFilter(stack.replace(/^/gm, '  '))
    .split('\n')
    .reduce((list, line) => {
      const minimalisticTraceFilter = ['soft-assert', 'Proxy.', 'at new AssertionError', 'chai-as-promised', 'chai/utils'];
      if (!minimalisticTraceFilter.every((filterStr) => line.indexOf(filterStr) === -1)) return list;

      list.push(line);
      return list;
    }, [] as string[])
    .join('\n');
  return `${msg}\n${stack}\n`;
}

export class SoftAssert {
  private captured: AssertionError[] = [];

  private capture(e: any) {
    if (e?.constructor?.name?.indexOf('AssertionError') >= 0) {
      this.captured.push(e as AssertionError);
    } else {
      throw e;
    }
  }

  proxy<T>(target: T): T {
    if (!target) {
      return target;
    }
    switch (typeof target) {
      case 'function':
        // @ts-ignore
        return this.proxyObj(this.proxyFn(target), target);
      case 'object':
        // @ts-ignore
        return this.proxyObj(target);
      default:
        return target;
    }
  }

  private proxyObj<T extends Record<string, unknown>>(target: T, original: T = target): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    if (!target) {
      return target;
    }
    return new Proxy(target, {
      get: function (_oTarget, sKey: string) {
        let value: unknown;
        try {
          value = original[sKey];
        } catch (e) {
          self.capture(e);
          return undefined;
        }
        if ((value as any)?.catch) {
          value = (value as any)?.catch((e: any) => self.capture(e));
        }
        return self.proxy(value);
      },
    }) as any as T;
  }

  private proxyFn<T extends Fn>(target: T): T {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const wrapperFn = function (...args) {
      let value: any;
      try {
        // @ts-ignore
        value = self.proxy(target.apply(this, args));
        if ((value as any)?.catch) {
          // @ts-ignore
          return (value as any)?.catch((e: any) => this.capture(e));
        }
        return value;
      } catch (e) {
        self.capture(e);
      }
      return value;
    };
    const binding = { [target.name]: wrapperFn }[target.name] as any as T;
    binding.prototype = target.prototype;
    return binding;
  }

  wrap<T extends Fn>(target: T): T {
    const isAsync = target.constructor.name === 'AsyncFunction';
    const params = target.length;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const wrapperFn = isAsync
      ? // eslint-disable-next-line consistent-return
        async function (...args) {
          try {
            // @ts-ignore
            return await target.apply(this, args);
          } catch (e) {
            self.capture(e);
          }
        }
      : // eslint-disable-next-line consistent-return
        function (...args) {
          try {
            // @ts-ignore
            return target.apply(this, args);
          } catch (e) {
            self.capture(e);
          }
        };
    const binding = { [target.name]: wrapperFn }[target.name] as any as T;
    Object.defineProperty(binding, 'length', {
      value: params,
    });
    return binding;
  }

  soft(target: Fn) {
    this.wrap(target)();
  }

  flush() {
    if (this.captured.length > 1) {
      const message = `Total failures are: ${this.captured.length}\n\n${this.captured.map(formatAssertionError).join('\n\n')}`;
      this.captured = [];
      throw new AssertionError({ message });
    } else if (this.captured.length === 1) {
      const message = this.captured[0];
      this.captured = [];
      throw message;
    }
  }
}

export const softAssert = new SoftAssert();
export const wrap = softAssert.wrap.bind(softAssert) as <T>(target: T) => T;
export const proxy = softAssert.proxy.bind(softAssert) as <T>(target: T) => T;
export const soft = softAssert.soft.bind(softAssert);
export const flush = softAssert.flush.bind(softAssert);
