module.exports = function(sequelize, DataTypes) {
  return sequelize.define('user_settings', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: DataTypes.STRING,
    key_name: DataTypes.STRING,
    value: DataTypes.STRING,
  });
};
