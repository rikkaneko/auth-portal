/// <reference path="../node_modules/@types/bootstrap/index.d.ts" />

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
    $('#user_label').prop('hidden', false);
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

  $('#user_profile_btn').on('click', async function () {
    await show_user_info_modal(logged_user.id);
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
    // User ID will be available after user creation or retrieve from context
    let user_info = $('#newUserModal').data('selected_user_info') ?? {};

    if (!$('#newUserTabContent form')[0].checkValidity()) {
      alert('Email is required field');
      return;
    }

    try {
      const mode = $('#createUser').data('mode');
      if (mode === 'new') {
        const res = await fetch('../api/user/create', {
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
        if (!res.ok) {
          const error_info = await res.json();
          alert(error_info.error.message);
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            alert(valid_result);
          }
        }
        const { id } = await res.json();
        user_info.id = id;
      } else if (mode === 'update') {
        const res = await fetch(`../api/user/update/${user_info.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Avoid dup key error
            username: user_info.username !== username ? username : undefined,
            fullname,
            status,
            role,
          }),
        });
        if (!res.ok) {
          const error_info = await res.json();
          alert(error_info.error.message);
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            alert(valid_result);
          }
        }
      }

      // Get the user groups
      const user_group_add = $('#userGroupsTable').data('new_group_list');
      const user_group_leave = $('#userGroupsTable').data('leave_group_list');
      // Remove exisiting user group
      if (user_group_leave) {
        for (const [_, group] of user_group_leave) {
          const res = await fetch('../api/user/leave_group', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: group.id,
              user_id: user_info.id,
            }),
          });
          if (!res.ok) {
            const error_info = await res.json();
            alert(error_info.error.message);
          }
        }
      }
      // Join new user group
      if (user_group_add) {
        for (const [_, new_group] of user_group_add) {
          const res = await fetch('../api/user/join_group', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: new_group.id,
              role: new_group.role,
              user_id: user_info.id,
            }),
          });
          if (!res.ok) {
            const error_info = await res.json();
            alert(error_info.error.message);
          }
        }
      }

      // Reload user list
      loadUsersPage();
      // Reload user modal
      await show_user_info_modal(user_info.id, false);
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
  $('#createGroup').on('click', async function () {
    // Get the group information from the form
    const groupId = $('#groupId').val();
    const groupName = $('#groupName').val();
    const groupType = $('#groupType').val() || undefined;
    // Extra: Course
    const courseYear = $('#courseYear').val();
    const course_meta = {
      course_year: courseYear,
    };
    let meta = undefined;

    if (groupType === 'course') {
      meta = course_meta;
    }

    // Get the group info
    const group_info = $('#newGroupModal').data('selected_group_info') ?? {};
    if (!$('#newGroupTabContent form')[0].checkValidity()) {
      alert('Group ID is required field');
      return;
    }

    try {
      const mode = $('#createGroup').data('mode');
      if (mode === 'new') {
        const res = await fetch('../api/group/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: groupId,
            name: groupName,
            type: groupType,
            meta,
          }),
        });
        if (!res.ok) {
          const error_info = await res.json();
          alert(error_info.error.message);
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            alert(valid_result);
          }
        }
        const { id } = await res.json();
        group_info.id = id;
      } else if (mode === 'update') {
        const res = await fetch(`../api/group/update/${group_info.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: groupName,
            meta,
          }),
        });
        if (!res.ok) {
          const error_info = await res.json();
          alert(error_info.error.message);
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            alert(valid_result);
          }
        }
      }

      // Get the user groups
      const group_memeber_add = $('#groupMembersTable').data('new_user_list');
      const group_memeber_remove = $('#groupMembersTable').data('remove_user_list');
      // Remove exisiting user group
      if (group_memeber_remove) {
        for (const [_, user] of group_memeber_remove) {
          const res = await fetch('../api/user/leave_group', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: group_info.id,
              user_id: user.id,
            }),
          });
          if (!res.ok) {
            const error_info = await res.json();
            alert(error_info.error.message);
          }
        }
      }
      // Join new user group
      if (group_memeber_add) {
        for (const [_, user] of group_memeber_add) {
          const res = await fetch('../api/user/join_group', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: group_info.id,
              role: user.role,
              user_id: user.id,
            }),
          });
          if (!res.ok) {
            const error_info = await res.json();
            alert(error_info.error.message);
          }
        }
      }

      // Reload user list
      loadGroupsPage();
      // Reload user modal
      await show_group_info_modal(group_info.id, false);
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
        alert(e.message);
      }
    }
  });

  // Add User button click event handler
  $('#addUserToGroup').on('click', function () {
    const userId = $('#userInput').val();
    const role = $('#addUserRoleInput').val();
    if (userId) {
      $('#groupMembersTable').prepend(/* html */ `
            <tr class='newly-added-item' data-id=${userId}>
              <td>${userId}</td>
              <td>${role}</td>
              <td class='text-end'>
                <button class="btn btn-sm btn-danger">Remove</button>
              </td>
            </tr>
          `);
      $('#userInput').val('');
      const new_user = { user_id: userId, role: [role] };
      const new_user_list = $('#groupMembersTable').data('new_user_list');
      if (new_user_list) {
        new_user_list.set(new_user.userId, new_user);
      } else {
        $('#groupMembersTable').data('new_user_list', new Map([[new_user.user_id, new_user]]));
      }
    }
  });

  // Remove Group Member button click event handler
  $('#groupMembersTable').on('click', '.btn-danger', function () {
    const row = $(this).closest('tr');
    const id = row.data('id');
    if (row.hasClass('newly-added-item')) {
      const new_user_list = $('#groupMembersTable').data('new_user_list');
      new_user_list.delete(id);
    } else {
      const remove_user_list = $('#groupMembersTable').data('remove_user_list');
      if (remove_user_list) {
        remove_user_list.push(id);
      } else {
        $('#groupMembersTable').data('remove_user_list', [id]);
      }
    }
    row.remove();
  });

  // Import Members button click event handler
  $('#importMembers').on('click', function () {
    const csvFile = $('#csvFile')[0].files[0];
    if (csvFile) {
      // Handle the CSV file upload and import members
      console.log('Importing members from CSV:', csvFile.name);
    }
  });

  $('#groupType').on('change', function () {
    update_group_info_model_opts($(this).val());
  });
});

// Build user list page
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
    $('#userID').closest('div').prop('hidden', true);
    $('#email').prop('disabled', false);
    $('#newUserModal').data('selected_user_info', null);
    bootstrap.Tab.getInstance($('#newUserTab li:first-child button')).show();
    $('#newUserModal').modal('show');
  });
}

// Build group list page
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
    $('#groupId').prop('disabled', false);
    $('#newGroupTabContent form')[0].reset();
    $('#groupMembersTable').empty();
    $('#newGroupModal').data('selected_group_info', null);
    update_group_info_model_opts();
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

    $('#user-table td .edit-button').on('click', async function () {
      await show_user_info_modal($(this).closest('tr').data('id'));
    });

    $('#user-table td .delete-button').on('click', async function () {
      try {
        const res = await fetch(`../api/user/delete/${$(this).closest('tr').data('id')}`, {
          method: 'POST',
        });
        if (!res.ok) {
          const error_info = await res.json();
          alert(error_info.error.message);
        }
        loadUsersPage();
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

// Build user info modal
async function show_user_info_modal(user_id, reset_tab = true) {
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
    $('newUserModal input').val();
    $('#userID').val(user.id);
    $('#userID').closest('div').prop('hidden', false);
    $('#username').val(user.username);
    $('#fullname').val(user.fullname);
    $('#email').val(user.linked_email);
    $('#email').prop('disabled', true);
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

    if (reset_tab) bootstrap.Tab.getInstance($('#newUserTab li:first-child button')).show();
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
      show_group_info_modal($(this).closest('tr').data('id'));
    });
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      alert(e.message);
    }
  }
}

// Build group info modal
async function show_group_info_modal(group_id) {
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
    $('#groupId').prop('disabled', true);
    $('#groupName').val(group_info.name);
    $('#groupType').val(group_info.type);
    // Show extra field for course type
    update_group_info_model_opts(group_info.type);
    if (group_info.type == 'course') {
      $('#courseYear').val(group_info.meta?.course_year || '');
    }

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
}

function update_group_info_model_opts(course_type) {
  $('#newGroupModal .group-extra-opts').prop('hidden', true);
  $('#newGroupModal .group-extra-opts > input').prop('disabled', true);
  if (course_type === 'course') {
    $('#newGroupModal .course-type-extra-opts').prop('hidden', false);
    $('#newGroupModal .course-type-extra-opts > input').prop('disabled', false);
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
