module.exports = function override(config) {
  config.experiments = { asyncWebAssembly: true }
  return config
}
