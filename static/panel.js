/// <reference path="../node_modules/@types/bootstrap/index.d.ts" />

// Shared variable
let logged_user = null;
let user_list = null;
let group_list = null;

function show_pop_alert(title, message, icon = 'bi-check-lg', confirm_handler, cancel_handler) {
  // Remove oldest toast
  const count = $('.toast-container').children().length;
  if (count > 6) {
    $('.toast-container').children().last().remove();
  }

  const toast_btn = `<div class="mt-3 text-end toast-btn-group">
      ${confirm_handler ? '<button type="button" class="btn btn-primary btn-sm ms-1">Confirm</button>' : ''}
      ${cancel_handler ? '<button type="button" class="btn btn-secondary btn-sm ms-1" data-bs-dismiss="Cancel">Close</button>' : ''}
    </div>`;

  const toast = $(
    `<div class="toast show" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="true">
        <div class="toast-header">
          <strong class="me-auto text-truncate"><i class="${icon} me-2"></i>${title}</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
          ${message}
          ${confirm_handler || cancel_handler ? toast_btn : ''}
        </div>
      </div>`
  );

  $('.toast-container').prepend(toast);

  $('.toast .btn-close').on('click', function () {
    $(this).closest('.toast').remove();
  });

  toast.find('.toast-btn-group .btn-primary').on('click', function () {
    confirm_handler();
    toast?.remove();
  });
  toast.find('.toast-btn-group .btn-secondary').on('click', function () {
    cancel_handler();
    toast?.remove();
  });

  // Auto remove current toast
  setTimeout(() => {
    toast?.remove();
  }, 10000);
}

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

  const page = window.location.href.split('#');
  if (page.length === 2) {
    switch (page[1]) {
      case 'user':
        loadUsersPage();
        break;
      case 'group':
        loadGroupsPage();
        break;
    }
  } else {
    // Load the initial page
    loadUsersPage();
  }

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
    const username = $('#user-info [name="user_id"]').val() || undefined;
    const fullname = $('#user-info [name="fullname"]').val() || '';
    const email = $('#user-info [name="email"]').val();
    const status = $('#user-info [name="status"]').val();
    const role = $('#user-info [name="role"]').val();
    // User ID will be available after user creation or retrieve from context
    let user_info = $('#newUserModal').data('selected_user_info') ?? {};

    if (!$('#newUserTabContent form')[0].checkValidity()) {
      show_pop_alert('Validation', 'Email is required field', 'bi-x-lg');
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
          show_pop_alert('User Creation', error_info.error.message, 'bi-x-lg');
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            show_pop_alert('Validation', valid_result.trim(), 'bi-x-lg');
          }
          return;
        }
        const { id } = await res.json();
        user_info.id = id;
        show_pop_alert('User Creation', `User ${user_info.id} created`);
      } else if (mode === 'update') {
        const update_info = {
          username,
          fullname,
          status,
          role: [role],
        };
        const res = await fetch(`../api/user/update/${user_info.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            object_map(update_info, (v, k) => {
              if ((v instanceof Array && v.sort().toString() === user_info[k].sort().toString()) || v === user_info[k])
                return undefined;
              else return v;
            })
          ),
        });
        if (!res.ok) {
          const error_info = await res.json();
          show_pop_alert('User Information Update', error_info.error.message, 'bi-x-lg');
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            show_pop_alert('Validation', valid_result.trim(), 'bi-x-lg');
          }
          return;
        }
        show_pop_alert('User Information Update', `User ${user_info.id} updated successfully`);
      }

      let all_pass = true;
      // Get the user groups
      const user_group_add = $('#userGroupsTable').data('new_group_list');
      const user_group_leave = $('#userGroupsTable').data('leave_group_list');
      // Remove exisiting user group
      if (user_group_leave) {
        for (const group_id of user_group_leave) {
          const res = await fetch('../api/user/leave_group', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: group_id,
              user_id: user_info.id,
            }),
          });
          if (!res.ok) {
            const error_info = await res.json();
            show_pop_alert(`Removing User ${group_id} From Group...`, error_info.error.message, 'bi-x-lg');
            all_pass = false;
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
            show_pop_alert(`Adding User To Group ${new_group.id}...`, error_info.error.message, 'bi-x-lg');
            all_pass = false;
          }
        }
      }

      if (user_group_leave || user_group_add)
        if (all_pass) {
          show_pop_alert('User Group Information Updated', `User group information updated successfully`);
        } else {
          show_pop_alert(
            'User Group Information Updated',
            `Some error occurred. The user group information is updated`
          );
        }

      // Reload user list
      loadUsersPage();
      // Reload user modal
      await show_user_info_modal(user_info.id, false);
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
        show_pop_alert('Internal Error', e.message, 'bi-x-lg');
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
                <button class="btn btn-sm btn-danger"><i class="bi bi-trash3"></i> Remove </button>
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
    const groupId = $('#group-info [name="group_id"]').val();
    const groupName = $('#group-info [name="group_name"]').val();
    const groupType = $('#group-info [name="group_type"]').val() || undefined;
    // Extra fields
    let meta = {};

    // Extra: Course
    if (groupType == 'course') {
      const courseDescription = $('#group-info [name="course_description"]').val();
      const courseCode = $('#group-info [name="course_code"]').val();
      const courseYear = $('#group-info [name="course_year"]').val();
      const courseSemester = $('.multi-select input:checked')
        .map((index, element) => parseInt($(element).val()))
        .get();

      const active = $('#group-info [name="course_is_active"]').is(':checked');
      meta = {
        course_description: courseDescription,
        course_code: courseCode,
        course_year: courseYear,
        course_semester: courseSemester,
        active,
      };
    }

    // Get the group info
    const group_info = $('#newGroupModal').data('selected_group_info') ?? {};
    if (!$('#newGroupTabContent form')[0].checkValidity()) {
      show_pop_alert('Validation', 'Group ID is required field', 'bi-x-lg');
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
            id: groupId.replace(/ /g, '_'),
            name: groupName,
            type: groupType,
            meta,
          }),
        });
        if (!res.ok) {
          const error_info = await res.json();
          show_pop_alert('Create Group', error_info.error.message, 'bi-x-lg');
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            show_pop_alert('Validation', valid_result.trim(), 'bi-x-lg');
          }
          return;
        }
        const { id } = await res.json();
        group_info.id = id;

        // Check if user id exists
        if (!logged_user?.id) {
          alert('Session expired. Please login again.');
          window.open(
            '../frontend/login?' +
              new URLSearchParams({
                panel: 1,
              }),
            '_self'
          );
          return;
        }
        const adminJoinGroupRes = await fetch('../api/user/join_group', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: group_info.id,
            role: 'admin',
            user_id: logged_user.id,
          }),
        });
        if (!adminJoinGroupRes.ok) {
          const error_info = await adminJoinGroupRes.json();
          show_pop_alert(`Creator Joining Group ${id}...`, error_info.error.message, 'bi-x-lg');
          console.error(error_info.error.message);
        }

        show_pop_alert('Group Created', `Group ${id} created`);
      } else if (mode === 'update') {
        const res = await fetch(`../api/group/update/${group_info.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: groupName,
            type: groupType,
            meta,
          }),
        });
        if (!res.ok) {
          const error_info = await res.json();
          show_pop_alert('Update Group', error_info.error.message, 'bi-x-lg');
          if (error_info.error.fields) {
            let valid_result = '';
            for (const [key, value] of Object.entries(error_info.error.fields)) {
              valid_result += `${key}: ${value}\n`;
            }
            show_pop_alert('Validation', valid_result.trim(), 'bi-x-lg');
          }
          return;
        }
        show_pop_alert('Group Information Update', `Group ${group_info.id} updated sucessfully`);
      }

      let all_pass = true;
      // Get the user groups
      const group_memeber_add = $('#groupMembersTable').data('new_user_list');
      const group_memeber_remove = $('#groupMembersTable').data('remove_user_list');
      // Remove exisiting user group
      if (group_memeber_remove) {
        for (const user_id of group_memeber_remove) {
          const res = await fetch('../api/user/leave_group', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: group_info.id,
              user_id: user_id,
            }),
          });
          if (!res.ok) {
            const error_info = await res.json();
            show_pop_alert(`Leaving Group ${group_info.id}...`, error_info.error.message, 'bi-x-lg');
            all_pass = false;
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
              user_id: user.user_id,
            }),
          });
          if (!res.ok) {
            const error_info = await res.json();
            show_pop_alert(`Joining Group ${group_info.id}...`, error_info.error.message, 'bi-x-lg');
            all_pass = false;
          }
        }
      }

      if (group_memeber_remove || group_memeber_add)
        if (all_pass) {
          show_pop_alert('Group Memeber List Updated', `Group memeber list updated successfully`);
        } else {
          show_pop_alert('Group Memeber List Updated', `Some error occurred. The group memeber list is updated`);
        }

      // Reload user list
      loadGroupsPage();
      // Reload user modal
      await show_group_info_modal(group_info.id, false);
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
        show_pop_alert('Internal Error', e.message, 'bi-x-lg');
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
                <button class="btn btn-sm btn-danger"><i class="bi bi-trash3"></i> Remove </button>
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

  $('#group-info [name="group_type"]').on('change', function () {
    update_group_info_model_opts($(this).val());
    if ($(this).val() !== 'course') {
      meta = undefined;
    }
  });

  $('#importMembers').on('click', async () => {
    const group_info = $('#newGroupModal').data('selected_group_info');
    if (!group_info) {
      show_pop_alert(`Import Members`, 'Please create the group first', 'bi-x-lg');
      return;
    }

    /** @type File | undefined */
    const upload_file = $('#importMembersInput').prop('files')[0];
    if (!upload_file) {
      show_pop_alert('Import Memeber', 'Please upload the file first', 'bi-x-lg');
      return;
    }
    try {
      const content = await upload_file.arrayBuffer();
      const res = await fetch(`../api/group/import_members/${group_info.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: new TextDecoder().decode(content),
      });
      if (!res.ok) {
        const error_info = await res.json();
        show_pop_alert(`Import Members`, error_info.error.message, 'bi-x-lg');
      } else {
        const result = await res.json();
        let import_log = `Imported ${result.success_count} entries`;
        import_log += `, failed ${result.failed_count ?? 0}`;
        import_log += result.failed_entries?.length > 0 ? '<br>====================' : '';
        result.failed_entries?.forEach((v) => {
          import_log += `<br>${v.user}: ${v.message}`;
        });
        show_pop_alert('Import Members', import_log);
      }
      // Reload group modal
      await show_group_info_modal(group_info.id, false);
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
        show_pop_alert('Internal Error', e.message, 'bi-x-lg');
      }
    }
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
        <div class="table-responsive">
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
        </div>
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
  $('#new_user_btn').on('click', async function () {
    $('#newUserModalLabel').text('New User');
    $('#createUser').text('Create');
    $('#createUser').data('mode', 'new');
    $('#newUserTabContent form')[0].reset();
    $('#userGroupsTable').empty();
    $('#user-info [name="user_id"]').closest('div').prop('hidden', true);
    $('#user-info [name="email"]').prop('disabled', false);
    $('#newUserModal').data('selected_user_info', null);
    bootstrap.Tab.getInstance($('#newUserTab li:first-child button')).show();

    // Setup authcomplete for group list
    if (!group_list) {
      const res = await fetch('../api/group/list');
      if (res.ok) {
        group_list = await res.json();
      }
    }

    $('#userInput')
      .autocomplete({
        source: group_list?.map((v) => v.id) ?? [],
        maxShowItems: 5,
        appendTo: '#user-info',
        minLength: 0,
      })
      .focus(function () {
        $(this).autocomplete('search');
      });

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
        <div class="table-responsive">
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
        </div>
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
  $('#new_group_btn').on('click', async function () {
    $('#newGroupModalLabel').text('New Group');
    $('#createGroup').text('Create');
    $('#createGroup').data('mode', 'new');
    $('#group-info [name="group_id"]').prop('disabled', false);
    $('#newGroupTabContent form')[0].reset();
    $('#groupMembersTable').empty();
    $('#newGroupModal').data('selected_group_info', null);
    update_group_info_model_opts();
    $('#group-info [name="group_type"]').prop('disabled', false);
    bootstrap.Tab.getInstance($('#newGroupTab li:first-child button')).show();
    $('#importMembersInput').val('');

    // Setup authcomplete for user list
    if (!user_list) {
      const res = await fetch('../api/user/list');
      if (res.ok) {
        user_list = await res.json();
      }
    }

    $('#userInput')
      .autocomplete({
        source: user_list?.map((v) => v.id) ?? [],
        maxShowItems: 5,
        appendTo: '#newGroupTabContent',
        minLength: 0,
      })
      .focus(function () {
        $(this).autocomplete('search');
      });

    $('#newGroupModal').modal('show');
  });
}

async function populateUserTable() {
  try {
    const res = await fetch('../api/user/list');
    if (!res.ok) {
      const error_info = await res.json();
      show_pop_alert('Fetch User Table', error_info.error.message, 'bi-x-lg');
      return;
    }
    user_list = await res.json();
    const userTableBody = $('#user-table tbody');
    user_list.forEach(function (user) {
      userTableBody.append(/* html */ `
      <tr data-id="${user.id}">
        <td>${user.username}</td>
        <td>${user.linked_email}</td>
        <td>${user.role}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary edit-button ms-1"><i class="bi bi-pencil-square"></i> Edit </button>
          <button class="btn btn-sm btn-danger delete-button ms-1"><i class="bi bi-trash3"></i> Delete </button>
        </td>
      </tr>
    `);
    });

    $('#user-table td .edit-button').on('click', async function () {
      await show_user_info_modal($(this).closest('tr').data('id'));
    });

    $('#user-table td .delete-button').on('click', async function () {
      const user_id = $(this).closest('tr').data('id');
      show_pop_alert(
        'User Deletion',
        `Confirm to delete user ${user_id}?`,
        'bi-question-circle',
        async () => {
          try {
            const res = await fetch(`../api/user/delete/${user_id}`, {
              method: 'POST',
            });
            if (!res.ok) {
              const error_info = await res.json();
              show_pop_alert(`User Deletion`, error_info.error.message, 'bi-x-lg');
              return;
            }
            show_pop_alert(`User Deletion`, `User ${user_id} deleted`);
            loadUsersPage();
          } catch (e) {
            if (e instanceof Error) {
              console.error(e.message);
              show_pop_alert('Internal Error', e.message, 'bi-x-lg');
            }
          }
        },
        () => {
          show_pop_alert(`User Deletion`, `Operation cancelled`);
        }
      );
    });
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      show_pop_alert('Internal Error', e.message, 'bi-x-lg');
    }
  }
}

// Build user info modal
async function show_user_info_modal(user_id, reset_tab = true) {
  try {
    const res = await fetch(`../api/user/list/${user_id}`);
    if (!res.ok) {
      const error_info = await res.json();
      show_pop_alert(`Fetching User Info for ${user_id}`, error_info.error.message, 'bi-x-lg');
      return;
    }
    const user = await res.json();
    // Cache selected user
    $('#newUserModal').data('selected_user_info', user);
    // Populate the form fields with the current user's information
    $('newUserModal input').val();
    $('#user-info [name="user_id"]').val(user.id).closest('div').prop('hidden', false);
    $('#user-info [name="username"]').val(user.username);
    $('#user-info [name="fullname"]').val(user.fullname);
    $('#user-info [name="email"]').val(user.linked_email).prop('disabled', true);
    $('#user-info [name="status"]').val(user.status);
    $('#user-info [name="role"]').val(user.role[0]);

    // Populate the user groups table
    $('#userGroupsTable').empty();
    user.groups.forEach(function ({ id, role }) {
      $('#userGroupsTable').append(/* html */ `
        <tr data-id="${id}">
          <td>${id}</td>
          <td>${role}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-danger"><i class="bi bi-trash3"></i> Remove </button>
          </td>
        </tr>
      `);
    });

    $('#newUserModalLabel').text(`User: ${user.id} (${user.linked_email})`);
    $('#createUser').text('Save');
    $('#createUser').data('mode', 'update');

    // Reset modified group list
    $('#userGroupsTable').data('new_group_list', null);
    $('#userGroupsTable').data('leave_group_list', null);

    if (reset_tab) bootstrap.Tab.getInstance($('#newUserTab li:first-child button')).show();

    if (!group_list) {
      const res = await fetch('../api/group/list');
      if (res.ok) {
        group_list = await res.json();
      }
    }

    $('#groupInput')
      .autocomplete({
        source: group_list?.map((v) => v.id) ?? [],
        appendTo: '#newUserTabContent',
        minLength: 0,
      })
      .focus(function () {
        $(this).autocomplete('search');
      });

    $('#newUserModal').modal('show');
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      show_pop_alert(`Internal Error`, e.message, 'bi-x-lg');
    }
  }
}

async function populateGroupTable() {
  try {
    const res = await fetch('../api/group/list');
    if (!res.ok) {
      const error_info = await res.json();
      show_pop_alert('Fetching Group List', error_info.error.message, 'bi-x-lg');
      return;
    }
    group_list = await res.json();
    const groupTableBody = $('#group-table tbody');
    group_list.forEach(function ({ id, name }) {
      groupTableBody.append(/* html */ `
      <tr data-id="${id}">
        <td>${id}</td>
        <td>${name}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-primary edit-button ms-1"><i class="bi bi-pencil-square"></i> Edit </button>
          <button class="btn btn-sm btn-danger delete-button ms-1"><i class="bi bi-trash3"></i> Delete </button>
        </td>
      </tr>
    `);
    });

    // Edit Group button click event handler
    $('#group-table td .edit-button').on('click', async function () {
      show_group_info_modal($(this).closest('tr').data('id'));
    });

    $('#group-table td .delete-button').on('click', async function () {
      const group_id = $(this).closest('tr').data('id');
      show_pop_alert(
        'Group Deletion',
        `Confirm to delete group ${group_id}?`,
        'bi-question-circle',
        async () => {
          try {
            const res = await fetch(`../api/group/delete/${group_id}`, {
              method: 'POST',
            });
            if (!res.ok) {
              const error_info = await res.json();
              show_pop_alert('Group Deletion', error_info.error.message, 'bi-x-lg');
              return;
            }
            show_pop_alert(`Group Deletion`, `Group ${group_id} deleted`);
            loadGroupsPage();
          } catch (e) {
            if (e instanceof Error) {
              console.error(e.message);
              show_pop_alert('Internal Error', e.message, 'bi-x-lg');
            }
          }
        },
        () => {
          show_pop_alert(`Group Deletion`, `Operation cancelled`);
        }
      );
    });
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      show_pop_alert('Internal Error', e.message, 'bi-x-lg');
    }
  }
}

// Build group info modal
async function show_group_info_modal(group_id, reset_tab = true) {
  try {
    // Retrieve group information
    const res1 = await fetch(`../api/group/list/${group_id}`);
    if (!res1.ok) {
      const error_info = await res1.json();
      show_pop_alert(`Fetching Group Info for ${group_id}`, error_info.error.message, 'bi-x-lg');
      return;
    }
    // Retrieve group memeber list
    const res2 = await fetch(`../api/group/list_members/${group_id}`);
    if (!res2.ok) {
      const error_info = await res2.json();
      show_pop_alert(`Fetching Group Info for ${group_id}`, error_info.error.message, 'bi-x-lg');
      return;
    }
    const group_info = await res1.json();
    const group_memeber_list = await res2.json();
    // Cache selected group
    $('#newGroupModal').data('selected_group_info', { ...group_info, members: group_memeber_list });
    // Populate the form fields with the current group's information
    $('#group-info [name="group_id"]').val(group_info.id).prop('disabled', true);
    $('#group-info [name="group_name"]').val(group_info.name);
    $('#group-info [name="group_type"]').val(group_info.type);
    // Show extra field for course type
    update_group_info_model_opts(group_info.type);
    if (group_info.type == 'course') {
      $('#group-info [name="course_description"]').val(group_info.meta?.course_description || '');
      $('#group-info [name="course_code"]').val(group_info.meta?.course_code || '');
      $('#group-info [name="course_year"]').val(group_info.meta?.course_year || '');
      group_info.meta?.course_semester?.forEach((v) => {
        $(`#group-info .multi-select input[type='checkbox'][value='${v}']`).prop('checked', true);
      });
      // $("#group-info .multi-select input[type='checkbox']").each(function () {
      //   const $checkbox = $(this);
      //   const semesterValue = parseInt($checkbox.val());
      //   $checkbox.prop('checked', group_info.meta?.course_semester?.includes(semesterValue));
      // });
      $('#group-info [name="course_is_active"]').prop('checked', group_info.meta?.active || false);
    }

    // Populate the group members table
    $('#groupMembersTable').empty();
    group_memeber_list?.forEach(function ({ user_id, role }) {
      $('#groupMembersTable').append(/* html */ `
            <tr data-id="${user_id}">
              <td>${user_id}</td>
              <td>${role[0]}</td>
              <td class="text-end">
                <button class="btn btn-sm btn-danger"><i class="bi bi-trash3"></i> Remove </button>
              </td>
            </tr>
          `);
    });

    // Reset modified group memeber list
    $('#groupMembersTable').data('new_user_list', null);
    $('#groupMembersTable').data('remove_user_list', null);

    $('#newGroupModalLabel').text(`Group: ${group_info.id}`);
    $('#createGroup').text('Save');
    $('#createGroup').data('mode', 'update');
    $('#importMembersInput').val('');

    if (reset_tab) bootstrap.Tab.getInstance($('#newGroupTab li:first-child button')).show();

    if (!user_list) {
      const res = await fetch('../api/user/list');
      if (res.ok) {
        user_list = await res.json();
      }
    }

    $('#userInput')
      .autocomplete({
        source: user_list?.map((v) => v.id) ?? [],
        appendTo: '#newGroupTabContent',
        minLength: 0,
      })
      .focus(function () {
        $(this).autocomplete('search');
      });

    $('#newGroupModal').modal('show');
  } catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
      show_pop_alert('Internal Error', e.message, 'bi-x-lg');
    }
  }
}

function update_group_info_model_opts(course_type) {
  const group = $('#group-info .group-extra-opts');
  group.prop('hidden', true);
  group.find('input').prop('disabled', true);
  group.find('input').not('[type="checkbox"]').val('');
  group.find('input[type="checkbox"]').prop('checked', false);
  if (course_type === 'course') {
    const course = $('#group-info .course-type-extra-opts');
    course.prop('hidden', false);
    course.find('input').prop('disabled', false);
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

function object_map(obj, func) {
  return Object.fromEntries(Object.entries(obj).map(([k, v], i) => [k, func(v, k, i)]));
}
