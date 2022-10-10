#!/usr/bin/perl

#
# Copyright (C) 2012 Nethesis S.r.l.
# http://www.nethesis.it - support@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see <http://www.gnu.org/licenses/>.
#

use strict;
use Authen::PAM;
use POSIX qw(ttyname);

my ( $pamh, $res );

my $userName = <STDIN>;
chomp($userName);

ref( $pamh = new Authen::PAM( 'system-auth', $userName, \&my_conv_func ) )
    || die "Error code $pamh during PAM init!";

$pamh->pam_set_item( PAM_TTY(), ttyname( fileno(STDIN) ) );
$res = $pamh->pam_authenticate();
exit 1 unless $res == PAM_SUCCESS();
exit 0;

sub my_conv_func {
    my @res;
    while (@_) {
        my $code = shift;
        my $msg  = shift;
        my $ans  = "";

        if ( $code == PAM_PROMPT_ECHO_ON() ) {
            $ans = $userName;
        }
        elsif ( $code == PAM_PROMPT_ECHO_OFF() ) {
            $ans = <STDIN>;
            chomp($ans);
        }

        push @res, ( PAM_SUCCESS(), $ans );
    }
    push @res, PAM_SUCCESS();
    return @res;
}
