module.exports = function (sequelize, DataTypes) {
    return sequelize.define('cdr', {
        calldate:      DataTypes.DATE,
        clid:          DataTypes.STRING,
        src:           DataTypes.STRING,
        dst:           DataTypes.STRING,
        dcontext:      DataTypes.STRING,
        channel:       DataTypes.STRING,
        dstchannel:    DataTypes.STRING,
        lastapp:       DataTypes.STRING,
        lastdata:      DataTypes.STRING,
        duration:      DataTypes.INTEGER,
        billsec:       DataTypes.INTEGER,
        disposition:   DataTypes.STRING,
        amaflags:      DataTypes.INTEGER,
        accountcode:   DataTypes.STRING,
        uniqueid:      { type: DataTypes.STRING, primaryKey: true },
        userfield:     DataTypes.STRING,
        recordingfile: DataTypes.STRING
    });
}
