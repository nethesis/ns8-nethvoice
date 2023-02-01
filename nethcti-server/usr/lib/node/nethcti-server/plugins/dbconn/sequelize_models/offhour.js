module.exports = function (sequelize, DataTypes) {
  return sequelize.define('offhour', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    displayname: DataTypes.STRING,
    didcidnum: DataTypes.STRING,
    didextension: DataTypes.STRING,
    tsbegin: DataTypes.INTEGER(10).UNSIGNED,
    tsend: DataTypes.INTEGER(10).UNSIGNED,
    message: DataTypes.STRING,
    action: DataTypes.INTEGER,
    param: DataTypes.STRING,
    destination: DataTypes.STRING,
    enabled: DataTypes.INTEGER(1)
  });
}
