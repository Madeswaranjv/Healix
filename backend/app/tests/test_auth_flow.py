"""Automated tests for User Authentication, Registration, and Multi-user Isolation."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.user_service import user_service
from app.services.session_service import session_service

@pytest.fixture(scope="module")
def client():
    return TestClient(app)

def test_demo_login(client):
    """Test demo login returns Jane Doe with valid token."""
    res = client.post("/auth/login", json={"email": "demo", "password": ""})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "token" in data
    assert len(data["token"]) > 10
    assert data["user"]["full_name"] == "Jane Doe, MD"

def test_new_user_registration_and_login(client):
    """Test registering a brand new user account with health profile."""
    import time
    ts = int(time.time())
    email = f"test_patient_{ts}@healix.test"
    preferred_name = f"Marcus_{ts}"
    password = "SafePassword999!"
    
    # 1. Register
    reg_payload = {
        "email": email,
        "password": password,
        "full_name": f"Marcus Vance {ts}",
        "preferred_name": preferred_name,
        "age": 29,
        "gender": "Male",
        "blood_group": "AB+",
        "allergies": ["Latex"],
        "chronic_conditions": ["Seasonal Rhinitis"],
        "current_medications": ["Cetirizine 10mg"]
    }
    res_reg = client.post("/auth/register", json=reg_payload)
    assert res_reg.status_code == 200
    reg_data = res_reg.json()
    assert reg_data["status"] == "success"
    assert "user" in reg_data
    assert "token" in reg_data
    assert len(reg_data["token"]) > 10
    user = reg_data["user"]
    assert user["email"] == email
    assert user["preferred_name"] == preferred_name
    user_id = user["id"]
    assert user_id.startswith("usr_")

    # 2a. Login with exact email
    res_login = client.post("/auth/login", json={"email": email, "password": password})
    assert res_login.status_code == 200
    login_data = res_login.json()
    assert login_data["status"] == "success"
    token = login_data["token"]
    assert len(token) > 10

    # 2b. Login with preferred name / username
    res_uname = client.post("/auth/login", json={"email": preferred_name, "password": password})
    assert res_uname.status_code == 200
    assert res_uname.json()["user"]["id"] == user_id

    # 2c. Login with mixed-case email
    res_case = client.post("/auth/login", json={"email": email.upper(), "password": password})
    assert res_case.status_code == 200
    assert res_case.json()["user"]["id"] == user_id
    token = res_case.json()["token"]

    # 3. Login with wrong password must fail
    res_fail = client.post("/auth/login", json={"email": email, "password": "WrongPassword!"})
    assert res_fail.status_code == 401

    # 4. Duplicate registration must fail
    res_dup = client.post("/auth/register", json=reg_payload)
    assert res_dup.status_code == 400

    # 5. Fetch user by token via /auth/me
    res_me = client.get(f"/auth/me?token={token}&user_id={user_id}")
    assert res_me.status_code == 200
    me_data = res_me.json()
    assert me_data["id"] == user_id
    assert me_data["full_name"] == f"Marcus Vance {ts}"
    assert "Latex" in me_data["allergies"]
    assert "password_hash" not in me_data

    # 6. User health summary formatting for LLM prompts
    summary = user_service.get_user_health_summary(user_id)
    assert "Marcus" in summary
    assert "Latex" in summary
    assert "Seasonal Rhinitis" in summary

    # 7. Create fresh empty session for this new user
    res_sess = client.post(f"/users/{user_id}/sessions", json={"title": "Allergy consultation"})
    assert res_sess.status_code == 200
    sess_data = res_sess.json()
    assert sess_data["user_id"] == user_id
    sess_id = sess_data["id"]

    # 8. Listing sessions immediately must NOT delete newly created empty session
    res_list_fresh = client.get(f"/users/{user_id}/sessions")
    assert res_list_fresh.status_code == 200
    assert any(s["id"] == sess_id for s in res_list_fresh.json())

    # 9. Add a message to this session
    msg = session_service.add_message(
        session_id=sess_id,
        role="user",
        content="Is cetirizine safe for seasonal rhinitis?",
        user_id=user_id
    )
    assert msg["session_id"] == sess_id

    # 10. Update profile
    res_upd = client.put(f"/users/{user_id}", json={
        "blood_group": "AB-",
        "allergies": ["Latex", "Pollen"]
    })
    assert res_upd.status_code == 200
    assert res_upd.json()["blood_group"] == "AB-"
    assert "Pollen" in res_upd.json()["allergies"]

    # 11. Logout
    res_out = client.post(f"/auth/logout?token={token}")
    assert res_out.status_code == 200

if __name__ == "__main__":
    from fastapi.testclient import TestClient
    c = TestClient(app)
    print("Testing demo login...")
    test_demo_login(c)
    print("Demo login: PASS")
    print("Testing new user registration and login...")
    test_new_user_registration_and_login(c)
    print("New user registration & login: PASS")
    print("ALL TESTS PASSED SUCCESSFULLY!")

