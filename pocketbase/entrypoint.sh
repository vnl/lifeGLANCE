#!/bin/sh
set -e

MARKER="/pb/pb_data/.ready"
ADMIN_EMAIL="admin@lifeglance.local"
ADMIN_PASS="lifeglance-local-admin"
PB_URL="http://127.0.0.1:8090"

# Start PocketBase in the background
/pb/pocketbase serve --http=0.0.0.0:8090 &

# Wait for PocketBase to be ready
until wget -qO /dev/null "$PB_URL/api/health" 2>/dev/null; do
    sleep 0.5
done

if [ ! -f "$MARKER" ]; then
    echo "[lifeGLANCE] First run: provisioning database..."

    # Create first admin account (PocketBase allows this without auth when no admins exist)
    cat > /tmp/admin.json << EOF
{"email":"$ADMIN_EMAIL","password":"$ADMIN_PASS","passwordConfirm":"$ADMIN_PASS"}
EOF
    wget -qO /tmp/admin_resp.json \
        --header="Content-Type: application/json" \
        --post-file=/tmp/admin.json \
        "$PB_URL/api/admins" 2>/dev/null || true

    # Authenticate to get token
    cat > /tmp/auth.json << EOF
{"identity":"$ADMIN_EMAIL","password":"$ADMIN_PASS"}
EOF
    wget -qO /tmp/auth_resp.json \
        --header="Content-Type: application/json" \
        --post-file=/tmp/auth.json \
        "$PB_URL/api/admins/auth-with-password" 2>/dev/null

    TOKEN=$(grep -o '"token":"[^"]*"' /tmp/auth_resp.json | cut -d'"' -f4)

    if [ -z "$TOKEN" ]; then
        echo "[lifeGLANCE] ERROR: could not authenticate with PocketBase — provisioning skipped."
    else
        # Create milestones collection
        cat > /tmp/milestones.json << 'EOF'
{
  "name": "milestones",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "schema": [
    {"name":"title",                  "type":"text",   "required":true,  "options":{"min":null,"max":80,"pattern":""}},
    {"name":"date",                   "type":"text",   "required":true,  "options":{"min":null,"max":null,"pattern":""}},
    {"name":"date_precision",         "type":"select", "required":true,  "options":{"maxSelect":1,"values":["day","month","year"]}},
    {"name":"direction",              "type":"select", "required":true,  "options":{"maxSelect":1,"values":["past","future"]}},
    {"name":"category",               "type":"text",   "required":false, "options":{"min":null,"max":null,"pattern":""}},
    {"name":"color",                  "type":"text",   "required":false, "options":{"min":null,"max":null,"pattern":""}},
    {"name":"note",                   "type":"text",   "required":false, "options":{"min":null,"max":500,"pattern":""}},
    {"name":"has_photo",              "type":"bool",   "required":false},
    {"name":"media_type",             "type":"select", "required":false, "options":{"maxSelect":1,"values":["audio","video"]}},
    {"name":"url",                    "type":"text",   "required":false, "options":{"min":null,"max":null,"pattern":""}},
    {"name":"recurrence",             "type":"select", "required":false, "options":{"maxSelect":1,"values":["annual"]}},
    {"name":"recurrence_id",          "type":"text",   "required":false, "options":{"min":null,"max":null,"pattern":""}},
    {"name":"mainTimelineVisibility", "type":"select", "required":false, "options":{"maxSelect":1,"values":["inherit","shown","hidden"]}},
    {"name":"photo",                  "type":"file",   "required":false, "options":{"maxSelect":1,"maxSize":10485760,"mimeTypes":[],"thumbs":[],"protected":false}},
    {"name":"media_file",             "type":"file",   "required":false, "options":{"maxSelect":1,"maxSize":104857600,"mimeTypes":[],"thumbs":[],"protected":false}}
  ]
}
EOF
        wget -qO /tmp/ms_resp.json \
            --header="Content-Type: application/json" \
            --header="Authorization: $TOKEN" \
            --post-file=/tmp/milestones.json \
            "$PB_URL/api/collections" 2>/dev/null && \
            echo "[lifeGLANCE] milestones collection created." || \
            echo "[lifeGLANCE] WARNING: milestones collection creation failed."

        # Create chapters collection
        cat > /tmp/chapters.json << 'EOF'
{
  "name": "chapters",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "",
  "updateRule": "",
  "deleteRule": "",
  "schema": [
    {"name":"title",                   "type":"text",   "required":true,  "options":{"min":null,"max":80,"pattern":""}},
    {"name":"start",                   "type":"text",   "required":true,  "options":{"min":null,"max":null,"pattern":""}},
    {"name":"end",                     "type":"text",   "required":true,  "options":{"min":null,"max":null,"pattern":""}},
    {"name":"color",                   "type":"text",   "required":false, "options":{"min":null,"max":null,"pattern":""}},
    {"name":"description",             "type":"text",   "required":false, "options":{"min":null,"max":300,"pattern":""}},
    {"name":"defaultMemberVisibility", "type":"select", "required":false, "options":{"maxSelect":1,"values":["shown","hidden"]}},
    {"name":"parentChapterId",         "type":"text",   "required":false, "options":{"min":null,"max":null,"pattern":""}},
    {"name":"milestoneIds",            "type":"json",   "required":false, "options":{"maxSize":2000000}}
  ]
}
EOF
        wget -qO /tmp/ch_resp.json \
            --header="Content-Type: application/json" \
            --header="Authorization: $TOKEN" \
            --post-file=/tmp/chapters.json \
            "$PB_URL/api/collections" 2>/dev/null && \
            echo "[lifeGLANCE] chapters collection created." || \
            echo "[lifeGLANCE] WARNING: chapters collection creation failed."

        touch "$MARKER"
        echo "[lifeGLANCE] Database ready."
    fi

    rm -f /tmp/admin.json /tmp/auth.json /tmp/milestones.json /tmp/chapters.json \
          /tmp/admin_resp.json /tmp/auth_resp.json /tmp/ms_resp.json /tmp/ch_resp.json
fi

wait
