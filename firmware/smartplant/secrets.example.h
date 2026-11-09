#pragma once

// Salin file ini menjadi secrets.h. Jangan bagikan secrets.h.
const char *WIFI_SSID = "NAMA_WIFI";
const char *WIFI_PASSWORD = "PASSWORD_WIFI";
const char *API_URL = "https://smartplant.SUBDOMAIN.workers.dev/api/telemetry";
const char *DEVICE_TOKEN = "TOKEN_ACAK_MINIMAL_32_KARAKTER_SAMA_DENGAN_WORKERS";

// Isi root CA PEM yang memvalidasi sertifikat domain API. Jangan gunakan setInsecure().
const char *ROOT_CA = R"PEM(
TEMPEL_ROOT_CA_PEM_DI_SINI
)PEM";
