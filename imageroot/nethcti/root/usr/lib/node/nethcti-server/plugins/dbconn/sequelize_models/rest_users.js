module.exports = function (sequelize, DataTypes) {
  return sequelize.define('rest_users', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    user_id: DataTypes.INTEGER,
    mobile: DataTypes.STRING
  });
}
