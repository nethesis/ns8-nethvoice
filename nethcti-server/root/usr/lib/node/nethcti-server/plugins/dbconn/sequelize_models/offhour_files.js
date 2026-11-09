module.exports = function (sequelize, DataTypes) {
  return sequelize.define('offhour_files', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: DataTypes.STRING,
    description: DataTypes.STRING,
    privacy: DataTypes.STRING,
    creation: DataTypes.DATE,
    path: DataTypes.STRING
  });
}
