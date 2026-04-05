"""
Backend API Tests for Sachin Schedule App
Tests: Auth endpoints, Schedule endpoints, History endpoints
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL environment variable not set")

class TestAuth:
    """Authentication endpoint tests"""

    def test_login_success(self):
        """Test login with valid admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sachin@example.com",
            "password": "sachin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "id" in data, "No user id in response"
        assert "email" in data, "No email in response"
        assert data["email"] == "sachin@example.com"
        assert data["name"] == "Sachin"
        assert data["role"] == "admin"
        
        # Verify no MongoDB _id in response
        assert "_id" not in data, "MongoDB _id should not be in response"

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sachin@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, "Should return 401 for invalid credentials"
        
        data = response.json()
        assert "detail" in data

    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "password123"
        })
        assert response.status_code == 401, "Should return 401 for non-existent user"

    def test_register_new_user(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_email = f"TEST_user_{timestamp}@example.com"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "Test User"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "id" in data
        assert data["email"] == test_email.lower()
        assert data["name"] == "Test User"
        assert data["role"] == "user"
        
        # Verify no MongoDB _id
        assert "_id" not in data

    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "sachin@example.com",
            "password": "password123",
            "name": "Duplicate User"
        })
        assert response.status_code == 400, "Should return 400 for duplicate email"
        
        data = response.json()
        assert "detail" in data
        assert "already registered" in data["detail"].lower()

    def test_auth_me_with_token(self):
        """Test /api/auth/me with valid token"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sachin@example.com",
            "password": "sachin123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Then call /api/auth/me
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        
        data = response.json()
        assert data["email"] == "sachin@example.com"
        assert data["name"] == "Sachin"
        assert "password_hash" not in data, "Password hash should not be in response"
        assert "_id" not in data, "MongoDB _id should not be in response"

    def test_auth_me_without_token(self):
        """Test /api/auth/me without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, "Should return 401 without token"


class TestSchedule:
    """Schedule endpoint tests"""

    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sachin@example.com",
            "password": "sachin123"
        })
        return response.json()["access_token"]

    def test_get_schedule(self, auth_token):
        """Test GET /api/schedule"""
        response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get schedule failed: {response.text}"
        
        data = response.json()
        assert "date" in data
        assert "day" in data
        assert "schedule" in data
        assert "completed_tasks" in data
        assert "total_tasks" in data
        assert "completed_count" in data
        
        # Verify schedule structure
        assert isinstance(data["schedule"], list)
        assert len(data["schedule"]) > 0, "Schedule should have blocks"
        
        # Check first block structure
        first_block = data["schedule"][0]
        assert "id" in first_block
        assert "time" in first_block
        assert "block" in first_block
        assert "title" in first_block
        assert "icon" in first_block
        assert "items" in first_block
        assert isinstance(first_block["items"], list)
        
        # Check task item structure
        if len(first_block["items"]) > 0:
            first_item = first_block["items"][0]
            assert "id" in first_item
            assert "text" in first_item
            assert "daily" in first_item

    def test_get_schedule_without_auth(self):
        """Test GET /api/schedule without authentication"""
        response = requests.get(f"{BASE_URL}/api/schedule")
        assert response.status_code == 401, "Should return 401 without auth"

    def test_toggle_task(self, auth_token):
        """Test POST /api/schedule/toggle"""
        # First get schedule to get a valid task_id
        schedule_response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        schedule_data = schedule_response.json()
        date_str = schedule_data["date"]
        initial_completed = schedule_data["completed_tasks"]
        
        # Get first task id
        first_block = schedule_data["schedule"][0]
        task_id = first_block["items"][0]["id"]
        was_completed = task_id in initial_completed
        
        # Toggle task
        response = requests.post(f"{BASE_URL}/api/schedule/toggle", 
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"task_id": task_id, "date": date_str}
        )
        assert response.status_code == 200, f"Toggle task failed: {response.text}"
        
        data = response.json()
        assert "date" in data
        assert "completed_tasks" in data
        assert "total_tasks" in data
        assert "completed_count" in data
        assert "completion_percentage" in data
        
        # Verify task state changed
        if was_completed:
            assert task_id not in data["completed_tasks"], "Task should be unchecked after toggle"
        else:
            assert task_id in data["completed_tasks"], "Task should be checked after toggle"
        
        # Toggle again to restore original state
        response2 = requests.post(f"{BASE_URL}/api/schedule/toggle",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"task_id": task_id, "date": date_str}
        )
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Verify task is back to original state
        if was_completed:
            assert task_id in data2["completed_tasks"], "Task should be back to completed"
        else:
            assert task_id not in data2["completed_tasks"], "Task should be back to uncompleted"

    def test_toggle_task_without_auth(self):
        """Test POST /api/schedule/toggle without authentication"""
        response = requests.post(f"{BASE_URL}/api/schedule/toggle", json={
            "task_id": "wash_face",
            "date": "2026-01-05"
        })
        assert response.status_code == 401, "Should return 401 without auth"


class TestHistory:
    """History endpoint tests"""

    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sachin@example.com",
            "password": "sachin123"
        })
        return response.json()["access_token"]

    def test_get_history_current_month(self, auth_token):
        """Test GET /api/history for current month"""
        response = requests.get(f"{BASE_URL}/api/history", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get history failed: {response.text}"
        
        data = response.json()
        assert "month" in data
        assert "year" in data
        assert "days" in data
        assert isinstance(data["days"], list)

    def test_get_history_specific_month(self, auth_token):
        """Test GET /api/history with specific month/year"""
        response = requests.get(f"{BASE_URL}/api/history?month=1&year=2026", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get history failed: {response.text}"
        
        data = response.json()
        assert data["month"] == 1
        assert data["year"] == 2026
        assert isinstance(data["days"], list)

    def test_get_history_without_auth(self):
        """Test GET /api/history without authentication"""
        response = requests.get(f"{BASE_URL}/api/history")
        assert response.status_code == 401, "Should return 401 without auth"


class TestDataPersistence:
    """Test data persistence after create/update operations"""

    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sachin@example.com",
            "password": "sachin123"
        })
        return response.json()["access_token"]

    def test_task_toggle_persists(self, auth_token):
        """Test that toggled tasks persist in database"""
        # Get schedule
        schedule_response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        schedule_data = schedule_response.json()
        date_str = schedule_data["date"]
        initial_completed = schedule_data["completed_tasks"]
        
        # Get a task that's not completed
        task_id = None
        for block in schedule_data["schedule"]:
            for item in block["items"]:
                if item["id"] not in initial_completed:
                    task_id = item["id"]
                    break
            if task_id:
                break
        
        if not task_id:
            pytest.skip("All tasks already completed")
        
        # Toggle task
        toggle_response = requests.post(f"{BASE_URL}/api/schedule/toggle",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"task_id": task_id, "date": date_str}
        )
        assert toggle_response.status_code == 200
        
        # Verify persistence by fetching schedule again
        verify_response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert task_id in verify_data["completed_tasks"], "Toggled task should persist in database"
