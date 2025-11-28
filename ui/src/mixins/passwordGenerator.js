/*
 * Copyright (C) 2025 Nethesis S.r.l.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GeneratePassword } from "generate-password-lite";

export const PasswordGeneratorService = {
  methods: {
    generateAdmPassword() {
      const forbiddenSpecialChars = "!#$&()*,-/;<=>[\\]`{|}~";
      const password = GeneratePassword({
        length: 16,
        symbols: true,
        numbers: true,
        uppercase: true,
        minLengthUppercase: 1,
        minLengthNumbers: 1,
        minLengthSymbols: 1,
        exclude: forbiddenSpecialChars,
      });
      return password;
    },
  },
};
