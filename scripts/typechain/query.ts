import { Result, ReturnNumber } from '@727-ventures/typechain-types';

export const customHandleReturnType = (result, typeDescription) => {
  if (typeof result === 'undefined' || typeof typeDescription === 'undefined') return result;
  if (result === null || typeDescription === null) return result;
  if (typeDescription.name === 'ReturnNumber') return new ReturnNumber(result);
  // missing handle Result :((((
  if (typeof result === 'object' && typeof typeDescription === 'object' && typeDescription.name.startsWith('Result<'))
    return new Result(customHandleReturnType(result.ok, typeDescription.body.ok), customHandleReturnType(result.err, typeDescription.body.err));
  if (typeof typeDescription === 'object' && typeDescription.name === 'Option')
    return result !== null ? customHandleReturnType(result, typeDescription.body[0]) : customHandleReturnType(result, typeDescription.body[1]);
  // end of missing handle Result :((((
  if (typeof result !== 'object' || typeof typeDescription !== 'object' || typeDescription.isPrimitive) return result;
  if (typeDescription.name === 'Array') {
    Object.entries(result).forEach(function (_a) {
      const key = _a[0],
        value = _a[1];
      result[key] = customHandleReturnType(value, typeDescription.body[0]);
    });
    return result;
  }
  Object.entries(result).forEach(function (obj) {
    result[obj[0]] = customHandleReturnType(obj[1], typeDescription.body[obj[0]]);
  });
  return result;
};
