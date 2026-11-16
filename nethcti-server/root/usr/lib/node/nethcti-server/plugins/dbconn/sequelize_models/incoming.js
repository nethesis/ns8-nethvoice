module.exports = function (sequelize, DataTypes) {
  return sequelize.define('incoming', {
    cidnum: { type: DataTypes.STRING, primaryKey: true },
    extension: DataTypes.STRING,
    destination: DataTypes.STRING,
    privacyman: DataTypes.INTEGER,
    alertinfo: DataTypes.STRING,
    ringing: DataTypes.STRING,
    mohclass: DataTypes.STRING,
    description: DataTypes.STRING,
    grppre: DataTypes.STRING,
    delay_answer: DataTypes.INTEGER,
    pricid: DataTypes.STRING,
    pmmaxretries: DataTypes.STRING,
    pmminlength: DataTypes.STRING,
    reversal: DataTypes.STRING,
    rvolume: DataTypes.STRING
  });
}