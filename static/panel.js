// Shared variable
let logged_user = null;
let user_list = null;
let group_list = null;

$(async function () {
  try {
    const res = await fetch('../api/user/me');
    if (!res.ok) {
      alert('Please login');
      window.open(
        '../frontend/login?' +
          new URLSearchParams({
            panel: 1,
          }),
        '_self'
      );
      return;
    }
    logged_user = await res.json();
    $('#login_username').text(logged_user.username);
    $('#login_role').text(logged_user.role[0]);
    $('#user_label').attr('hidden', false);
  } catch (e) {
    if (e instanceof Error) {
      console.error(e);
      alert(e.message);
    }
  }

  // Load the initial page
  loadUsersPage();

  // Sidebar click event handlers
  $('#user-sidebar').on('click', function () {
    loadUsersPage();
  });
  $('#group-sidebar').on('click', function () {
    loadGroupsPage();
  });

  // Navbar click event handlers
  $('#users-nav').on('click', function () {
    loadUsersPage();
  });
  $('#groups-nav').on('click', function () {
    loadGroupsPage();
  });

  $('#user_profile_btn').on('click', function () {
    show_user_info_modal(logged_user.id);
  });

  $('#logout_btn').on('click', async function () {
    try {
      await fetch('../api/auth/logout');
      alert('Logout');
      window.open(
        '../frontend/login?' +
          new URLSearchParams({
            panel: 1,
          }),
        '_self'
      );
    } catch (e) {
      if (e instanceof Error) console.error(e.message);
    }
  });

  // Setup event handler for User Modal
  // Create User button click event handler
  $('#createUser').on('click', async function () {
    // Get the user information from the form
    const username = $('#username').val() || undefined;
    const fullname = $('#fullname').val() || undefined;
    const email = $('#email').val();
    const status = $('#status').val();
    const role = $('#role').val();

    if (!$('#newUserTabContent form')[0].checkValidity()) {
      alert('Email is required field');
      return;
    }

    // Get the user groups
    const user_group = $('#userGroupsTable').data('new_group_list');

    try {
      const mode = $('#createUser').data('mode');
      if (mode === 'new') {
        const res1 = await fetch('../api/user/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            linked_email: email,
            fullname,
            status,
            role,
          }),
        });
        if (!res1.ok) {
          const error_info = await res1.json();
          alert(error_info.error.message);
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            alert(valid_result);
          }
          return;
        }
        const new_user = await res1.json();
        if (user_group) {
          for (const [_, new_group] of user_group) {
            const res = await fetch('../api/user/join_group', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: new_group.id,
                role: new_group.role,
                user_id: new_user.id,
              }),
            });
            if (!res.ok) {
              const error_info = await res.json();
              alert(error_info.error.message);
              return;
            }
          }
        }
        // Close the modal
        $('#newUserModal').modal('hide');
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
        alert(e.message);
      }
    }
  });

  // Add Group button click event handler
  $('#addGroupToUser').on('click', function () {
    const groupId = $('#groupInput').val();
    const role = $('#joinGroupRoleInput').val();
    if (groupId) {
      $('#userGroupsTable').prepend(/* html */ `
            <tr class='newly-added-item' data-id=${groupId}>
              <td>${groupId}</td>
              <td>${role}</td>
              <td class='text-end'>
                <button class="btn btn-sm btn-danger">Remove</button>
              </td>
            </tr>
          `);
      $('#groupInput').val('');
      const new_group = { id: groupId, role: [role] };
      const new_group_list = $('#userGroupsTable').data('new_group_list');
      if (new_group_list) {
        new_group_list.set(new_group.id, new_group);
      } else {
        $('#userGroupsTable').data('new_group_list', new Map([[new_group.id, new_group]]));
      }
    }
  });

  // Remove User Group button click event handler
  $('#userGroupsTable').on('click', '.btn-danger', function () {
    const row = $(this).closest('tr');
    const id = row.data('id');
    if (row.hasClass('newly-added-item')) {
      const new_group_list = $('#userGroupsTable').data('new_group_list');
      new_group_list.delete(id);
    } else {
      const leave_group_list = $('#userGroupsTable').data('leave_group_list');
      if (leave_group_list) {
        leave_group_list.push(id);
      } else {
        $('#userGroupsTable').data('leave_group_list', [id]);
      }
    }
    row.remove();
  });

  // Setup event handler for Group Modal
  // Create Group button click event handler
  $('#createGroup').on('click', function () {
    // Get the group information from the form
    const groupId = $('#groupId').val();
    const groupName = $('#groupName').val();
    const validYears = $('#validYears').val();
    const groupAdmin = $('#groupAdmin').val();

    // Get the group members
    const groupMembers = [];
    $('#groupMembersTable tr').each(function () {
      groupMembers.push($(this).find('td:first-child').text());
    });

    // Perform the necessary actions to create the new group
    console.log('Group Information:');
    console.log('Group ID:', groupId);
    console.log('Group Name:', groupName);
    console.log('Valid Years:', validYears);
    console.log('Group Admin:', groupAdmin);
    console.log('Group Members:', groupMembers);

    // Close the modal
    $('#newGroupModal').modal('hide');
  });

  // Add User button click event handler
  $('#addUserToGroup').on('click', function () {
    const userId = $('#userInput').val();
    const role = $('#addUserRoleInput').val();
    if (userId) {
      $('#groupMembersTable').prepend(/* html */ `
            <tr>
              <td>${userId}</td>
              <td>${role}</td>
              <td class='text-end'>
                <button class="btn btn-sm btn-danger">Remove</button>
              </td>
            </tr>
          `);
      $('#userInput').val('');
    }
  });

  // Remove Group Member button click event handler
  $('#groupMembersTable').on('click', '.btn-danger', function () {
    $(this).closest('tr').remove();
  });

  // Import Members button click event handler
  $('#importMembers').on('click', function () {
    const csvFile = $('#csvFile')[0].files[0];
    if (csvFile) {
      // Handle the CSV file upload and import members
      console.log('Importing members from CSV:', csvFile.name);
    }
  });
});

function loadUsersPage() {
  // Replace the main content with the users page
  $('#main-content').html(/* html */ ` 
        <h2>Users</h2>
        <div class="mb-3">
          <input type="text" class="form-control" id="user-filter" placeholder="Filter users...">
        </div>
        <button class="btn btn-primary mb-3" id="new_user_btn">New User</button>
        <table class="table" id="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <!-- User list will be added here -->
          </tbody>
        </table>
      `);

  // Populate the user table
  populateUserTable();

  // Add event listener for user filter
  $('#user-filter').on('input', function () {
    filterUserTable();
  });

  // Add event listener for user table header clicks
  $('#user-table th').on('click', function () {
    sortUserTable($(this).index());
  });

  // New User button click event handler
  $('#new_user_btn').on('click', function () {
    $('#newUserModalLabel').text('New User');
    $('#createUser').text('Create');
    $('#createUser').data('mode', 'new');
    $('#newUserTabContent form')[0].reset();
    $('#userGroupsTable').empty();
    $('#userID').closest('div').attr('hidden', true);
    $('#email').attr('disabled', false);
    $('#newUserModal').data('selected_user_info', null);
    $('#newUserModal').modal('show');
  });
}

function loadGroupsPage() {
  // Replace the main content with the groups page
  $('#main-content').html(/* html */ `
        <h2>Groups</h2>
        <div class="mb-3">
          <input type="text" class="form-control" id="group-filter" placeholder="Filter groups...">
        </div>
        <button class="btn btn-primary mb-3" id="new_group_btn">New Group</button>
        <table class="table" id="group-table">
          <thead>
            <tr>
              <th>Group ID</th>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <!-- Group list will be added here -->
          </tbody>
        </table>
      `);

  // Populate the group table
  populateGroupTable();

  // Add event listener for group filter
  $('#group-filter').on('input', function () {
    filterGroupTable();
  });

  // Add event listener for group table header clicks
  $('#group-table th').on('click', function () {
    sortGroupTable($(this).index());
  });

  // New Group button click event handler
  $('#new_group_btn').on('click', function () {
    $('#newGroupModalLabel').text('New Group');
    $('#createGroup').text('Create');
    $('#createGroup').data('mode', 'new');
    $('#groupId').attr('disabled', false);
    $('#newGroupTabContent form')[0].reset();
    $('#groupMembersTable').empty();
    $('#newGroupModal').data('selected_group_info', null);
    $('#newGroupModal').modal('show');
  });
}

async function populateUserTable() {
  try {
    const res = await fetch('../api/user/list');
    if (!res.ok) {
      const error_info = await res.json();
      alert(error_info.error.message);
      return;
    }
    user_list = await res.json();
    const userTableBody = $('#user-table tbody');
    user_list.forEach(function (user) {
      userTableBody.append(/* html */ `
      <tr data-id=${user.id}>
        <td>${user.username}</td>
        <td>${user.linked_email}</td>
        <td>${user.role[0]}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary edit-button">Edit</button>
          <button class="btn btn-sm btn-danger delete-button">Delete</button>
        </td>
      </tr>
    `);
    });

    $('#user-table td .edit-button').on('click', function () {
      show_user_info_modal($(this).closest('tr').data('id'));
    });
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      alert(e.message);
    }
  }
}

async function show_user_info_modal(user_id) {
  try {
    const res = await fetch(`../api/user/list/${user_id}`);
    if (!res.ok) {
      const error_info = await res.json();
      alert(error_info.error.message);
      return;
    }
    const user = await res.json();
    // Cache selected user
    $('#newUserModal').data('selected_user_info', user);
    // Populate the form fields with the current user's information
    $('#userID').val(user.id);
    $('#userID').closest('div').attr('hidden', false);
    $('#username').val(user.username);
    $('#fullname').val(user.fullname);
    $('#email').val(user.linked_email);
    $('#email').attr('disabled', true);
    $('#status').val(user.status);
    $('#role').val(user.role[0]);

    // Populate the user groups table
    $('#userGroupsTable').empty();
    user.groups.forEach(function ({ id, role }) {
      $('#userGroupsTable').append(/* html */ `
        <tr data-id=${id}>
          <td>${id}</td>
          <td>${role}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-danger">Remove</button>
          </td>
        </tr>
      `);
    });

    $('#newUserModalLabel').text('Update User');
    $('#createUser').text('Save');
    $('#createUser').data('mode', 'update');

    // Reset modified group list
    $('#userGroupsTable').data('new_group_list', null);
    $('#userGroupsTable').data('leave_group_list', null);

    $('#newUserModal').modal('show');
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      alert(e.message);
    }
  }
}

async function populateGroupTable() {
  try {
    const res = await fetch('../api/group/list');
    if (!res.ok) {
      const error_info = await res.json();
      alert(error_info.error.message);
      return;
    }
    group_list = await res.json();
    const groupTableBody = $('#group-table tbody');
    group_list.forEach(function ({ id, name }) {
      groupTableBody.append(/* html */ `
      <tr data-id=${id}>
        <td>${id}</td>
        <td>${name}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary edit-button">Edit</button>
          <button class="btn btn-sm btn-danger delete-button">Delete</button>
        </td>
      </tr>
    `);
    });

    // Edit Group button click event handler
    $('#group-table td .edit-button').on('click', async function () {
      const group_id = $(this).closest('tr').data('id');
      try {
        // Retrieve group information
        const res1 = await fetch(`../api/group/list/${group_id}`);
        if (!res1.ok) {
          const error_info = await res1.json();
          alert(error_info.error.message);
          return;
        }
        // Retrieve group memeber list
        const res2 = await fetch(`../api/group/list_members/${group_id}`);
        if (!res2.ok) {
          const error_info = await res2.json();
          alert(error_info.error.message);
          return;
        }
        const group_info = await res1.json();
        const group_memeber_list = await res2.json();
        // Cache selected group
        $('#newGroupModal').data('selected_group_info', { ...group_info, members: group_memeber_list });
        // Populate the form fields with the current group's information
        $('#groupId').val(group_info.id);
        $('#groupId').attr('disabled', true);
        $('#groupName').val(group_info.name);

        const admin_list = [];
        // Populate the group members table
        $('#groupMembersTable').empty();
        group_memeber_list.forEach(function ({ user_id, role }) {
          if (role.includes('admin')) admin_list.push(user_id);
          $('#groupMembersTable').append(/* html */ `
            <tr data-id=${user_id}>
              <td>${user_id}</td>
              <td>${role[0]}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-danger">Remove</button>
              </td>
            </tr>
          `);
        });
        $('#groupAdmin').val(admin_list.toString());

        $('#newGroupModalLabel').text('Update Group');
        $('#createGroup').text('Save');
        $('#createGroup').data('mode', 'update');
        $('#newGroupModal').modal('show');
      } catch (e) {
        if (e instanceof Error) {
          console.error(e.message);
          alert(e.message);
        }
      }
    });
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      alert(e.message);
    }
  }
}

function filterUserTable() {
  const filter = $('#user-filter').val().toLowerCase();
  $('#user-table tbody tr').filter(function () {
    $(this).toggle($(this).text().toLowerCase().indexOf(filter) > -1);
  });
}

function sortUserTable(columnIndex) {
  const table = $('#user-table');
  const rows = table.find('tbody tr').get();
  rows.sort(function (a, b) {
    const aText = $(a).children('td').eq(columnIndex).text().toLowerCase();
    const bText = $(b).children('td').eq(columnIndex).text().toLowerCase();
    if (aText < bText) return -1;
    if (aText > bText) return 1;
    return 0;
  });
  $.each(rows, function (index, row) {
    table.children('tbody').append(row);
  });
}

function filterGroupTable() {
  const filter = $('#group-filter').val().toLowerCase();
  $('#group-table tbody tr').filter(function () {
    $(this).toggle($(this).text().toLowerCase().indexOf(filter) > -1);
  });
}

function sortGroupTable(columnIndex) {
  const table = $('#group-table');
  const rows = table.find('tbody tr').get();
  rows.sort(function (a, b) {
    const aText = $(a).children('td').eq(columnIndex).text().toLowerCase();
    const bText = $(b).children('td').eq(columnIndex).text().toLowerCase();
    if (aText < bText) return -1;
    if (aText > bText) return 1;
    return 0;
  });
  $.each(rows, function (index, row) {
    table.children('tbody').append(row);
  });
}
