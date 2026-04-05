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
        
        # V2: Verify end_time field exists in all blocks
        for block in data["schedule"]:
            assert "end_time" in block, f"Block {block['id']} missing end_time field"
        
        # V2: Verify we have 11 blocks
        assert len(data["schedule"]) == 11, f"Expected 11 blocks, got {len(data['schedule'])}"
        
        # V2: Verify task_timings field exists
        assert "task_timings" in data, "task_timings field missing from response"

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



class TestV2Features:
    """V2 Feature Tests: Task timing, Analytics, Day detail"""

    @pytest.fixture
    def auth_token(self):
        """Get auth token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "sachin@example.com",
            "password": "sachin123"
        })
        return response.json()["access_token"]

    def test_set_task_time(self, auth_token):
        """Test POST /api/schedule/set-time"""
        # Get schedule to get valid task_id and date
        schedule_response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        schedule_data = schedule_response.json()
        date_str = schedule_data["date"]
        task_id = schedule_data["schedule"][0]["items"][0]["id"]
        
        # Set actual time for task
        response = requests.post(f"{BASE_URL}/api/schedule/set-time",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"task_id": task_id, "date": date_str, "actual_time": "06:15"}
        )
        assert response.status_code == 200, f"Set task time failed: {response.text}"
        
        data = response.json()
        assert data["status"] == "ok"
        assert data["task_id"] == task_id
        assert data["actual_time"] == "06:15"
        
        # Verify persistence by fetching schedule again
        verify_response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        verify_data = verify_response.json()
        assert task_id in verify_data["task_timings"], "Task timing should persist"
        assert verify_data["task_timings"][task_id] == "06:15"

    def test_get_analytics(self, auth_token):
        """Test GET /api/analytics"""
        response = requests.get(f"{BASE_URL}/api/analytics?days=30", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get analytics failed: {response.text}"
        
        data = response.json()
        # Verify all required fields
        assert "total_days_tracked" in data
        assert "avg_completion" in data
        assert "perfect_days" in data
        assert "most_missed_tasks" in data
        assert "best_tasks" in data
        assert "delay_insights" in data
        assert "streak" in data
        assert "period_days" in data
        
        # Verify data types
        assert isinstance(data["total_days_tracked"], int)
        assert isinstance(data["avg_completion"], int)
        assert isinstance(data["perfect_days"], int)
        assert isinstance(data["most_missed_tasks"], list)
        assert isinstance(data["best_tasks"], list)
        assert isinstance(data["delay_insights"], list)
        assert isinstance(data["streak"], int)
        assert data["period_days"] == 30

    def test_get_analytics_different_periods(self, auth_token):
        """Test GET /api/analytics with different period values"""
        for days in [7, 14, 30]:
            response = requests.get(f"{BASE_URL}/api/analytics?days={days}", headers={
                "Authorization": f"Bearer {auth_token}"
            })
            assert response.status_code == 200, f"Analytics failed for {days} days"
            data = response.json()
            assert data["period_days"] == days

    def test_get_day_detail(self, auth_token):
        """Test GET /api/history/day/{date_str}"""
        # Use today's date
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/history/day/{today}", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Get day detail failed: {response.text}"
        
        data = response.json()
        # Verify all required fields
        assert "date" in data
        assert "day" in data
        assert "schedule" in data
        assert "completed_tasks" in data
        assert "incomplete_tasks" in data
        assert "incomplete_details" in data
        assert "completed_details" in data
        assert "task_timings" in data
        assert "total_tasks" in data
        assert "completed_count" in data
        assert "completion_percentage" in data
        
        # Verify incomplete_details structure
        assert isinstance(data["incomplete_details"], list)
        if len(data["incomplete_details"]) > 0:
            inc_task = data["incomplete_details"][0]
            assert "id" in inc_task
            assert "text" in inc_task
            assert "block" in inc_task
            assert "scheduled_time" in inc_task
        
        # Verify completed_details structure
        assert isinstance(data["completed_details"], list)
        if len(data["completed_details"]) > 0:
            comp_task = data["completed_details"][0]
            assert "id" in comp_task
            assert "text" in comp_task
            assert "block" in comp_task
            assert "scheduled_time" in comp_task

    def test_morning_routine_is_one_block(self, auth_token):
        """Test that Morning Routine is ONE unified block"""
        response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        data = response.json()
        
        # Find Morning Routine block
        morning_blocks = [b for b in data["schedule"] if "Morning Routine" in b["title"]]
        assert len(morning_blocks) == 1, f"Expected 1 Morning Routine block, found {len(morning_blocks)}"
        
        morning_block = morning_blocks[0]
        assert morning_block["time"] == "08:10"
        assert morning_block["end_time"] == "09:30"
        
        # Verify it contains hygiene + diet + get ready items
        item_texts = [item["text"].lower() for item in morning_block["items"]]
        assert any("brush" in t for t in item_texts), "Morning Routine should include brush"
        assert any("bath" in t for t in item_texts), "Morning Routine should include bath"
        assert any("perfume" in t or "deodorant" in t for t in item_texts), "Morning Routine should include perfume/deodorant"

    def test_sunday_shows_study_sessions(self, auth_token):
        """Test that schedule shows Study sessions on Sunday (not Work)"""
        response = requests.get(f"{BASE_URL}/api/schedule", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        data = response.json()
        
        # Check if today is Sunday
        if data["day"] == "Sunday":
            # Find session blocks
            session_blocks = [b for b in data["schedule"] if "Session" in b["title"]]
            
            # Should have Study Session 1 and Study Session 2
            study_sessions = [b for b in session_blocks if "Study" in b["title"]]
            work_sessions = [b for b in session_blocks if "Work" in b["title"]]
            
            assert len(study_sessions) == 2, f"Expected 2 Study sessions on Sunday, found {len(study_sessions)}"
            assert len(work_sessions) == 0, f"Expected 0 Work sessions on Sunday, found {len(work_sessions)}"
        else:
            pytest.skip(f"Today is {data['day']}, not Sunday. Skipping Sunday-specific test.")
