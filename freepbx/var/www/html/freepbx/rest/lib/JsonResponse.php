<?php

use Psr\Http\Message\ResponseInterface;

if (!function_exists('jsonResponse')) {
    function jsonResponse(ResponseInterface $response, $data, int $status = 200, int $encodingOptions = 0): ResponseInterface
    {
        $json = json_encode($data, $encodingOptions);
        if ($json === false) {
            throw new RuntimeException(json_last_error_msg(), json_last_error());
        }

        $response->getBody()->write($json);

        return $response
            ->withHeader('Content-Type', 'application/json;charset=utf-8')
            ->withStatus($status);
    }
}