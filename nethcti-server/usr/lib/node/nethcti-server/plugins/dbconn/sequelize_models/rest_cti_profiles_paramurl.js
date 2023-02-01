module.exports = function (sequelize, DataTypes) {
  return sequelize.define('rest_cti_profiles_paramurl', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    profile_id: DataTypes.INTEGER,
    url: DataTypes.STRING,
    only_queues: DataTypes.BOOLEAN
  });
}
