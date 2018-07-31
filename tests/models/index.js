const requireAll = require('require-all');

/** @function
 * @description prepare (init) the mongoose models
 *
 */

const init = () => {

  const models = requireAll({
    dirname: __dirname,
    filter: /(.+Model)\.js$/
  });

  for (let modelName of Object.keys(models))
    ctx[modelName] = models[modelName]();

};

const ctx = {
  init: init
};

/** @factory
 * @return {{init: init, ...Models}}
 */

module.exports = ctx;
