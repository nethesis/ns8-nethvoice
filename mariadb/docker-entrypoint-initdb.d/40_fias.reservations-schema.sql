USE `fias`;

CREATE TABLE IF NOT EXISTS `reservations` (
  `room_number` int(8) NOT NULL,
  `reservation_number` int(10) PRIMARY KEY ,
  `guest_name` varchar(40) default NULL,
  `guest_language` varchar(2) default 'EA',
  `share_flag` char (1) default 'N',
  `checkindate` timestamp default CURRENT_TIMESTAMP,
  `checkoutdate` timestamp
);