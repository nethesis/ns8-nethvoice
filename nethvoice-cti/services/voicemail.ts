// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import axios from 'axios';

const PATH = '/voicemail';

import { getApiEndpoint, getApiScheme, handleNetworkError } from '../lib/utils'
import { eventDispatch } from '../lib/hooks/eventDispatch';

export const getAllVoicemails = async () => {
    try {
        const response = await axios.get(`${PATH}/list/all`);
        return response.data.rows;
    } catch (error) {
        handleNetworkError(error)
        throw error
    }
};

export const getVoicemailById = async (id: string) => {
    try {
        const response = await axios.get(`${PATH}/list/${id}`);
        return response.data.rows;
    } catch (error) {
        handleNetworkError(error)
        throw error
    }
};

export const downloadVoicemail = async (id: any) => {
    try {
        const response = await axios.get(`${PATH}/download/${id}`);

        const filename = response.data;
        if (!filename) {
            console.error("Error: the server did not return the file name.");
            return;
        }
        const fileUrl = `${getApiScheme()}${getApiEndpoint()}/api/static/${filename}`;

        const link = document.createElement("a");
        link.href = fileUrl
        link.download = filename
        link.click()        
    } catch (error) {
        handleNetworkError(error);
        throw error;
    }
};

export const deleteVoicemail = async (id: any) => {
    try {
        await axios.post(`${PATH}/delete`, { id: id.toString() });
    } catch (error) {
        handleNetworkError(error);
        throw error;
    }
}

export const uploadVoicemailGreetingMessage = async (type: string, audio: string) => {
    try {
        await axios.post(`${PATH}/custom_msg`, {
            'type': type,
            'audio': audio
        });
    } catch (error) {
        handleNetworkError(error);
        throw error;
    }
}

export const uploadVoicemailGreetingMessageFromFile = async (type: string, tempFilename: string) => {
    try {
        await axios.post(`${PATH}/custom_msg_from_file`, {
            'type': type,
            'tempFilename': tempFilename
        });
    } catch (error) {
        handleNetworkError(error);
        throw error;
    }
}

export const getVoicemailGreetingMessage = async (type: string) => {
    try {
        const response = await axios.get(`${PATH}/listen_custom_msg/${type}`);
        return response.data;
    } catch (error) {
        handleNetworkError(error);
        throw error;
    }
}

export const deleteVoicemailGreetingMessage = async (type: string) => {
    try {
        await axios.delete(`${PATH}/custom_msg/${type}`);
    } catch (error) {
        handleNetworkError(error);
        throw error;
    }
}

// The event to show the recording view.
export function recordingMessage(type: string) {
  if (type === 'physical' || type === 'nethlink') {
    eventDispatch('phone-island-physical-recording-view', {})
  } else {
    eventDispatch('phone-island-recording-open', {})
  }
}
