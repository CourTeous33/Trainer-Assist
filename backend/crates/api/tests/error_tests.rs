use axum::http::StatusCode;
use axum::response::IntoResponse;

use api::error::AppError;

#[tokio::test]
async fn not_found_returns_404() {
    let err = AppError::not_found("Pokemon not found");
    let response = err.into_response();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn not_found_returns_json_body() {
    let err = AppError::not_found("Pokemon not found");
    let response = err.into_response();
    let body = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"], "Pokemon not found");
}

#[tokio::test]
async fn internal_returns_500() {
    let err = AppError::internal("Something went wrong");
    let response = err.into_response();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn internal_returns_json_body() {
    let err = AppError::internal("Database error");
    let response = err.into_response();
    let body = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["error"], "Database error");
}

#[tokio::test]
async fn from_serde_error() {
    let err: serde_json::Error = serde_json::from_str::<String>("not valid json").unwrap_err();
    let app_err: AppError = err.into();
    let response = app_err.into_response();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
}
