#!/usr/bin/env perl

use strict;
use JSON;
use NethServer::SSSD;
my $sssd = NethServer::SSSD->new();

my $provider;




if (! $sssd->isLdap() and ! $sssd->isAD() ) {
    $provider->{'configured'} = 0;
} else {
    $provider->{'configured'} = 1;

    if ($sssd->isLocalProvider()) {
        $provider->{'local'} = 1;
    } else {
        $provider->{'local'} = 0;
    }
    if ($sssd->isLdap()) {
        $provider->{'type'} = 'ldap';
    } elsif ($sssd->isAD()) {
        $provider->{'type'} = 'ad';
    }
}

print encode_json($provider);
