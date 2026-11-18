module.exports = function (sequelize, DataTypes) {
  return sequelize.define('userman_users', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    username: DataTypes.STRING
  });
}
