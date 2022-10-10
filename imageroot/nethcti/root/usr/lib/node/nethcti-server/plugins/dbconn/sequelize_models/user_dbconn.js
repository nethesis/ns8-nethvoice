module.exports = function(sequelize, DataTypes) {
  return sequelize.define('user_dbconn', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    host: DataTypes.STRING,
    port: DataTypes.INTEGER,
    type: DataTypes.STRING,
    user: DataTypes.STRING,
    pass: DataTypes.STRING,
    name: DataTypes.STRING,
    creation: DataTypes.DATE
  });
};
