module.exports = function (sequelize, DataTypes) {
    return sequelize.define('voicemessages', {
        id:  {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        msgnum: DataTypes.INTEGER,
        dir: DataTypes.STRING,
        context: DataTypes.STRING,
        macrocontext: DataTypes.STRING,
        callerid: DataTypes.STRING,
        origtime: DataTypes.STRING,
        duration: DataTypes.STRING,
        mailboxuser: DataTypes.STRING,
        mailboxcontext: DataTypes.STRING,
        recording: DataTypes.BLOB,
        flag: DataTypes.BOOLEAN,
        read: DataTypes.INTEGER,
        msg_id: DataTypes.STRING
    });
};
