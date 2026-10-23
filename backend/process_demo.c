#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/wait.h>

int main(void) {
    printf("Parent process started. PID = %d\n", getpid());

    pid_t pid = fork();

    if (pid < 0) {
        perror("fork");
        return 1;
    }

    if (pid == 0) {
        printf("Child process created. PID = %d\n", getpid());
        fflush(stdout);
        _exit(0);
    } else {
        printf("Parent is waiting for child PID = %d\n", pid);

        int status;
        if (waitpid(pid, &status, 0) == -1) {
            perror("waitpid");
            return 1;
        }

        printf("Child process finished.\n");
    }

    return 0;
}
